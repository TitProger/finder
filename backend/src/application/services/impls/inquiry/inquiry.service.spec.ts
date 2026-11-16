import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { CanonicalProductEntity } from '../../../../domain/entities/catalog/canonical-product.entity';
import { InquiryAnswerEntity } from '../../../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { DailyUsageEntity } from '../../../../domain/entities/tariff/daily-usage.entity';
import { PlanEntity } from '../../../../domain/entities/tariff/plan.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { normalizePhrase } from '../../../../domain/text/phrase-text';
import { CategoryPhraseRepository } from '../../../../domain/repositories/category/category-phrase.repository';
import { CategoryQuestionRepository } from '../../../../domain/repositories/category/category-question.repository';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { QuestionPackRepository } from '../../../../domain/repositories/category/question-pack.repository';
import { InquiryAnswerRepository } from '../../../../domain/repositories/inquiry/inquiry-answer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { OptimalCardRepository } from '../../../../domain/repositories/market/optimal-card.repository';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { DailyUsageRepositoryImpl } from '../../../../infrastructure/database/postgres/repositories/tariff/daily-usage.repository.impl';
import { PlanRepositoryImpl } from '../../../../infrastructure/database/postgres/repositories/tariff/plan.repository.impl';
import { ClientDialog } from '../../contracts/inquiry/inquiry.service';
import { LimitCheckerServiceImpl } from '../tariff/limit-checker.service.impl';
import { InquiryServiceImpl } from './inquiry.service.impl';

type Stored = { id: string };

function matches(entity: object, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, expected]) => {
        const actual = (entity as Record<string, unknown>)[key];

        if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
            if (actual === null || actual === undefined || typeof actual !== 'object') {
                return false;
            }

            return matches(actual, expected as Record<string, unknown>);
        }

        if (typeof expected === 'string' && actual !== null && typeof actual === 'object' && actual && 'id' in actual) {
            return (actual as { id: string }).id === expected;
        }

        return actual === expected;
    });
}

function stamp<T>(entity: T, data: object): T {
    Object.assign(entity, data);
    const dated = entity as T & { createdAt?: Date; updatedAt?: Date | null };

    if (!dated.createdAt) {
        dated.createdAt = new Date();
    }

    if (dated.updatedAt === undefined) {
        dated.updatedAt = null;
    }

    return entity;
}

/** Как disableIdentityMap: find отдаёт копию, flush переносит только persist(). */
function detach<T extends Stored>(entity: T): T {
    return Object.assign(Object.create(Object.getPrototypeOf(entity)), entity);
}

function buildHarness(options?: {
    launchResearch?: boolean;
    launch?: 'ok' | 'fail-once';
    tariff?: 'repository';
}) {
    const users: AppUserEntity[] = [];
    const categories: CategoryEntity[] = [];
    const phrases: CategoryPhraseEntity[] = [];
    const packs: QuestionPackEntity[] = [];
    const questions: CategoryQuestionEntity[] = [];
    const inquiries: InquiryEntity[] = [];
    const answers: InquiryAnswerEntity[] = [];
    const cards: OptimalCardEntity[] = [];
    const lists = new Map<object, Stored[]>();
    const pending = new Set<Stored>();
    const em = {
        persist(entity: Stored) {
            const list = lists.get(entity.constructor);

            if (!list) {
                throw new Error(`Нет списка для ${entity.constructor.name}`);
            }

            const stored = list.find((item) => item === entity || item.id === entity.id);

            if (!stored) {
                list.push(entity);
            }

            pending.add(entity);

            return em;
        },
        remove(entity: Stored) {
            const list = lists.get(entity.constructor);
            const index = list?.findIndex((item) => item === entity || item.id === entity.id) ?? -1;

            if (list && index >= 0) {
                list.splice(index, 1);
            }

            pending.delete(entity);

            return em;
        },
        async flush() {
            for (const entity of pending) {
                const list = lists.get(entity.constructor);
                const stored = list?.find((item) => item.id === entity.id);

                if (stored && stored !== entity) {
                    Object.assign(stored, entity);
                }
            }

            pending.clear();
        },
        async persistAndFlush(entity: Stored) {
            em.persist(entity);
            await em.flush();
        },
    };

    function repo<T extends Stored>(Ctor: new () => T, items: T[]) {
        lists.set(Ctor, items);

        return {
            create(data: object) {
                return stamp(new Ctor(), data);
            },
            find(where: Record<string, unknown>) {
                return Promise.resolve(items.filter((item) => matches(item, where)).map((item) => detach(item)));
            },
            findOne(where: Record<string, unknown>) {
                const found = items.find((item) => matches(item, where));

                return Promise.resolve(found ? detach(found) : null);
            },
            getEntityManager() {
                return em;
            },
        };
    }

    const userRepo = repo(AppUserEntity, users);
    const phraseRepo = {
        ...repo(CategoryPhraseEntity, phrases),
        findByCategoryStatus(status: CategoryStatus) {
            return Promise.resolve(phrases.filter((phrase) => phrase.category.status === status));
        },
    };
    const planFindOne = jest.fn(async (_entity: unknown, where: { code?: string }) => {
        if (where.code !== 'free') {
            return null;
        }

        return stamp(new PlanEntity(), {
            code: 'free',
            title: 'Бесплатный',
            dailyResearchLimit: 3,
        });
    });
    const usageRows: { userId: string; usageDate: string; researchCount: number }[] = [];
    const usageEm = {
        async findOne(_entity: unknown, where: { user?: string; usageDate?: string }) {
            const row = usageRows.find((item) => item.userId === where.user && item.usageDate === where.usageDate);

            if (!row) {
                return null;
            }

            return stamp(new DailyUsageEntity(), { usageDate: row.usageDate, researchCount: row.researchCount });
        },
        create(_entity: unknown, data: { user: string; usageDate: string; researchCount: number }) {
            const row = { userId: data.user, usageDate: data.usageDate, researchCount: data.researchCount };
            const created = stamp(new DailyUsageEntity(), {
                usageDate: data.usageDate,
                researchCount: data.researchCount,
            });

            return Object.assign(created, { row });
        },
        async persistAndFlush(entity: DailyUsageEntity & { row?: (typeof usageRows)[number] }) {
            if (entity.row) {
                usageRows.push(entity.row);
            }
        },
        getKnex() {
            return {
                async raw(_sql: string, params: [string, string]) {
                    const [userId, usageDate] = params;
                    const row = usageRows.find((item) => item.userId === userId && item.usageDate === usageDate);

                    if (row) {
                        row.researchCount += 1;

                        return;
                    }

                    usageRows.push({ userId, usageDate, researchCount: 1 });
                },
            };
        },
    };
    const limitChecker =
        options?.tariff === 'repository'
            ? new LimitCheckerServiceImpl(
                  userRepo as unknown as AppUserRepository,
                  new PlanRepositoryImpl({ getEntityManager: () => ({ findOne: planFindOne }) } as never),
                  new DailyUsageRepositoryImpl({ getEntityManager: () => usageEm } as never),
              )
            : {
                  canStartResearch: jest.fn().mockResolvedValue({ allowed: true }),
                  incrementResearchUsage: jest.fn().mockResolvedValue(undefined),
              };
    const launchState = { count: 0 };
    const launchMode = options?.launch ?? (options?.launchResearch ? 'ok' : 'off');
    const researchLaunch =
        launchMode === 'off'
            ? undefined
            : {
                  async startForInquiry(inquiry: InquiryEntity) {
                      launchState.count += 1;

                      if (launchMode === 'fail-once' && launchState.count === 1) {
                          throw new Error('webhook down');
                      }

                      inquiry.status = InquiryStatus.RESEARCHING;
                      em.persist(inquiry);
                      await em.flush();
                  },
              };
    const service = new InquiryServiceImpl(
        repo(InquiryEntity, inquiries) as unknown as InquiryRepository,
        userRepo as unknown as AppUserRepository,
        repo(CategoryEntity, categories) as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        repo(QuestionPackEntity, packs) as unknown as QuestionPackRepository,
        repo(CategoryQuestionEntity, questions) as unknown as CategoryQuestionRepository,
        repo(InquiryAnswerEntity, answers) as unknown as InquiryAnswerRepository,
        repo(OptimalCardEntity, cards) as unknown as OptimalCardRepository,
        limitChecker as any,
        undefined,
        researchLaunch as any,
    );
    const usersRepo = {
        create: (data: object) => {
            const user = stamp(new AppUserEntity(), data);

            em.persist(user);

            return user;
        },
    };
    const categoriesRepo = {
        create: (data: object) => {
            const category = stamp(new CategoryEntity(), data);

            em.persist(category);

            return category;
        },
    };
    const phrasesRepo = {
        create: (data: object) => {
            const phrase = stamp(new CategoryPhraseEntity(), data);

            em.persist(phrase);

            return phrase;
        },
    };
    const packsRepo = {
        create: (data: object) => {
            const pack = stamp(new QuestionPackEntity(), data);

            em.persist(pack);

            return pack;
        },
    };
    const questionsRepo = {
        create: (data: object) => {
            const question = stamp(new CategoryQuestionEntity(), data);

            em.persist(question);

            return question;
        },
    };

    const admin = usersRepo.create({
        role: UserRole.ADMIN,
        telegramUserId: null,
        displayName: 'Админ',
        isActive: true,
    });

    const cardsRepo = {
        create: (data: object) => {
            const card = stamp(new OptimalCardEntity(), data);

            em.persist(card);

            return card;
        },
    };

    return {
        service,
        admin,
        phrases,
        categories,
        usersRepo,
        categoriesRepo,
        phrasesRepo,
        packsRepo,
        questionsRepo,
        cardsRepo,
        inquiries,
        answers,
        planFindOne,
        launchCount: () => launchState.count,
    };
}

const CLOTHING_BASE = [
    'Что именно за изделие? (например: халат лабораторный, футболка, куртка)',
    'Количество (штук)',
    'Материал (например: хлопок, полиэстер, смесовая ткань)',
    'Размерный ряд и доли размеров (например: S-10%, M-40%, L-40%, XL-10%)',
    'Цвет',
    'Нужен ли свой крой или логотип?',
    'Какая цена в России уже попадалась? (рублей за штуку)',
    'Город доставки',
];
const CLOTHING_PACK = 'Многоразовый или одноразовый?';

function seedClothing(harness: ReturnType<typeof buildHarness>) {
    const category = harness.categoriesRepo.create({
        code: 'clothing',
        name: 'Одежда',
        description: 'Одежда без цены',
        status: CategoryStatus.ACTIVE,
    });
    const pack = harness.packsRepo.create({
        category,
        code: 'workwear',
        title: 'Спецодежда и лабораторные халаты',
        description: 'Дополнительные вопросы для медицинской и защитной одежды',
        sortOrder: 0,
        isActive: true,
    });

    CLOTHING_BASE.forEach((prompt, index) => {
        harness.questionsRepo.create({
            category,
            questionPack: null,
            prompt,
            answerType: index === 1 ? QuestionAnswerType.NUMBER : QuestionAnswerType.TEXT,
            choices: null,
            isRequired: index === 0 || index === 1 || index === 7,
            sortOrder: index + 1,
        });
    });
    harness.questionsRepo.create({
        category,
        questionPack: pack,
        prompt: CLOTHING_PACK,
        answerType: QuestionAnswerType.SINGLE_CHOICE,
        choices: ['Многоразовый', 'Одноразовый'],
        isRequired: true,
        sortOrder: 1,
    });

    return category;
}

async function assignClothing(telegramUserId: number) {
    const harness = buildHarness();
    const category = seedClothing(harness);
    const created = await harness.service.create({ telegramUserId, text: 'нужна куртка' });

    await harness.service.assignCategory({
        inquiryId: created.inquiry.id,
        categoryId: category.id,
        adminUserId: harness.admin.id,
    });

    return { harness, created };
}

function seedShoes(harness: ReturnType<typeof buildHarness>) {
    const category = harness.categoriesRepo.create({
        name: 'Обувь',
        description: 'Обувь без цены',
        status: CategoryStatus.ACTIVE,
    });
    const work = harness.packsRepo.create({
        category,
        code: 'WORKWEAR',
        title: 'Спецодежда',
        description: 'когда спецодежда',
        sortOrder: 0,
        isActive: true,
    });
    const summer = harness.packsRepo.create({
        category,
        code: 'SUMMER',
        title: 'Лето',
        description: 'когда лето',
        sortOrder: 1,
        isActive: true,
    });

    harness.phrasesRepo.create({ category, phrase: 'кроссовки' });
    harness.questionsRepo.create({
        category,
        questionPack: null,
        prompt: 'Размер?',
        answerType: QuestionAnswerType.TEXT,
        choices: null,
        isRequired: true,
        sortOrder: 2,
    });
    harness.questionsRepo.create({
        category,
        questionPack: work,
        prompt: 'Ткань?',
        answerType: QuestionAnswerType.TEXT,
        choices: null,
        isRequired: true,
        sortOrder: 0,
    });
    harness.questionsRepo.create({
        category,
        questionPack: summer,
        prompt: 'Сезон?',
        answerType: QuestionAnswerType.TEXT,
        choices: null,
        isRequired: false,
        sortOrder: 0,
    });

    return category;
}

describe('InquiryServiceImpl', () => {
    it('фраза из category_phrase выбирает категорию и только базовые вопросы', async () => {
        const harness = buildHarness();
        const category = seedShoes(harness);
        const view = await harness.service.create({ telegramUserId: 100, text: '  Кроссовки  ' });

        expect(view.inquiry.category?.id).toBe(category.id);
        expect(view.inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(view.inquiry.isPaused).toBe(false);
        expect(view.inquiry.questionPack).toBeNull();
        expect(view.inquiry.rawText).toBe('Кроссовки');
        expect(view.questions.map((question) => question.prompt)).toEqual(['Размер?']);
        expect(view.inquiry.status).not.toBe(InquiryStatus.RESEARCHING);
    });

    it('неизвестная фраза остаётся на паузе и не открывает ресерч', async () => {
        const harness = buildHarness();

        seedShoes(harness);
        const view = await harness.service.create({ telegramUserId: 100, text: 'нужен станок' });

        expect(view.inquiry.category ?? null).toBeNull();
        expect(view.inquiry.status).toBe(InquiryStatus.AWAITING_CATEGORY);
        expect(view.inquiry.isPaused).toBe(true);
        expect(view.inquiry.pauseReason).toContain('категория не выбрана');
        expect(view.inquiry.classificationScores).toMatchObject({ outcome: 'no_match', stub: false });
        expect(view.questions).toEqual([]);
        expect(view.inquiry.status).not.toBe(InquiryStatus.RESEARCHING);
    });

    it('назначение админом снимает паузу и сохраняет фразу', async () => {
        const harness = buildHarness();
        const category = seedShoes(harness);
        const created = await harness.service.create({ telegramUserId: 100, text: 'нужен станок' });
        const assigned = await harness.service.assignCategory({
            inquiryId: created.inquiry.id,
            categoryId: category.id,
            adminUserId: harness.admin.id,
        });
        const saved = harness.phrases.find(
            (phrase) => phrase.category.id === category.id && normalizePhrase(phrase.phrase) === 'нужен станок',
        );

        expect(assigned.inquiry.isPaused).toBe(false);
        expect(assigned.inquiry.pauseReason).toBeNull();
        expect(assigned.inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(assigned.inquiry.category?.id).toBe(category.id);
        expect(assigned.inquiry.assignedByUser?.id).toBe(harness.admin.id);
        expect(saved?.phrase).toBe('нужен станок');
        expect(assigned.questions.map((question) => question.prompt)).toEqual(['Размер?']);
        expect(assigned.inquiry.status).not.toBe(InquiryStatus.RESEARCHING);

        const again = await harness.service.create({ telegramUserId: 100, text: 'нужен станок' });

        expect(again.inquiry.category?.id).toBe(category.id);
        expect(again.inquiry.isPaused).toBe(false);
    });

    it('клиент 8604571553 отвечает на первый вопрос «Одежда» и получает следующий', async () => {
        const { harness, created } = await assignClothing(8604571553);

        // Так колонку bigint гидратит дефолтный BigIntType: 8604571553n !== "8604571553".
        created.inquiry.clientUser.telegramUserId = BigInt(8604571553) as unknown as string;

        const next = await harness.service.answerQuestion({
            inquiryId: created.inquiry.id,
            telegramUserId: 8604571553,
            text: 'лабораторный халат',
        });

        expect(next.kind).toBe('asking');

        if (next.kind !== 'asking') {
            return;
        }

        expect(next.prompt).toBe('Количество (штук)');
        expect(next.index).toBe(1);
        expect(next.total).toBe(CLOTHING_BASE.length);
    });

    it('тот же владелец проходит, если telegram id загружен числом', async () => {
        const { harness, created } = await assignClothing(8604571553);

        created.inquiry.clientUser.telegramUserId = 8604571553 as unknown as string;

        const next = await harness.service.answerQuestion({
            inquiryId: created.inquiry.id,
            telegramUserId: 8604571553,
            text: 'лабораторный халат',
        });

        expect(next.kind).toBe('asking');

        if (next.kind !== 'asking') {
            return;
        }

        expect(next.prompt).toBe('Количество (штук)');
        expect(next.total).toBe(CLOTHING_BASE.length);
    });

    it('подгружает владельца, если clientUser пришёл только с id', async () => {
        const { harness, created } = await assignClothing(8604571553);
        const ownerId = created.inquiry.clientUser.id;

        created.inquiry.clientUser = { id: ownerId } as AppUserEntity;

        const next = await harness.service.answerQuestion({
            inquiryId: created.inquiry.id,
            telegramUserId: 8604571553,
            text: 'лабораторный халат',
        });

        expect(next.kind).toBe('asking');

        if (next.kind !== 'asking') {
            return;
        }

        expect(next.prompt).toBe('Количество (штук)');
        expect(next.total).toBe(CLOTHING_BASE.length);
    });

    it('владелец не с ролью CLIENT получает отдельную ошибку', async () => {
        const { harness, created } = await assignClothing(8604571553);

        created.inquiry.clientUser.role = UserRole.ADMIN;

        await expect(
            harness.service.answerQuestion({
                inquiryId: created.inquiry.id,
                telegramUserId: 8604571553,
                text: 'лабораторный халат',
            }),
        ).rejects.toMatchObject({
            message: 'Telegram user id принадлежит не клиенту',
            context: { code: 'INQUIRY_CLIENT_ROLE' },
        });
    });

    it('чужой telegram user не отвечает на заявку клиента', async () => {
        const { harness, created } = await assignClothing(8604571553);

        await expect(
            harness.service.answerQuestion({
                inquiryId: created.inquiry.id,
                telegramUserId: 871909427,
                text: 'лабораторный халат',
            }),
        ).rejects.toMatchObject({
            message: 'Заявка принадлежит другому клиенту',
            context: { code: 'INQUIRY_NOT_CLIENT' },
        });
    });

    it('назначение «Одежда» переживает повторную загрузку и берёт только базовые вопросы', async () => {
        const harness = buildHarness();
        const category = seedClothing(harness);
        const created = await harness.service.create({ telegramUserId: 100, text: 'нужна куртка' });
        const assigned = await harness.service.assignCategory({
            inquiryId: created.inquiry.id,
            categoryId: category.id,
            adminUserId: harness.admin.id,
        });
        const reloaded = await harness.service.getById(created.inquiry.id);

        expect(assigned.inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(reloaded.inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(reloaded.inquiry.isPaused).toBe(false);
        expect(reloaded.inquiry.category?.id).toBe(category.id);
        expect(reloaded.inquiry.category?.name).toBe('Одежда');
        expect(reloaded.inquiry.questionPack ?? null).toBeNull();
        expect(reloaded.questions.map((question) => question.prompt)).toEqual(CLOTHING_BASE);
        expect(reloaded.questions.some((question) => question.prompt === CLOTHING_PACK)).toBe(false);
        expect(reloaded.inquiry.status).not.toBe(InquiryStatus.AWAITING_CATEGORY);
    });

    it('пакет одежды добавляется только когда текст совпал с пакетом', async () => {
        const harness = buildHarness();
        const category = seedClothing(harness);
        const created = await harness.service.create({ telegramUserId: 100, text: 'workwear' });
        const assigned = await harness.service.assignCategory({
            inquiryId: created.inquiry.id,
            categoryId: category.id,
            adminUserId: harness.admin.id,
        });

        expect(assigned.inquiry.questionPack?.code).toBe('workwear');
        expect(assigned.questions.map((question) => question.prompt)).toEqual([...CLOTHING_BASE, CLOTHING_PACK]);
    });

    it('категория без вопросов после назначения запускает ресерч', async () => {
        const harness = buildHarness({ launchResearch: true });
        const category = harness.categoriesRepo.create({
            name: 'Пустая',
            description: 'Без вопросов',
            status: CategoryStatus.ACTIVE,
        });
        const created = await harness.service.create({ telegramUserId: 100, text: 'редкая вещь' });
        const assigned = await harness.service.assignCategory({
            inquiryId: created.inquiry.id,
            categoryId: category.id,
            adminUserId: harness.admin.id,
        });
        const reloaded = await harness.service.getById(created.inquiry.id);

        expect(assigned.questions).toEqual([]);
        expect(assigned.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(reloaded.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(reloaded.inquiry.category?.id).toBe(category.id);
        expect(reloaded.inquiry.isPaused).toBe(false);
    });

    it('создание категории назначает её и сохраняет фразу без вектора', async () => {
        const harness = buildHarness();

        seedShoes(harness);
        const created = await harness.service.create({ telegramUserId: 7, text: 'насос' });
        const assigned = await harness.service.createCategoryAndAssign({
            inquiryId: created.inquiry.id,
            adminUserId: harness.admin.id,
            name: ' Насосы ',
            description: ' Насосы без цены ',
        });
        const category = harness.categories.find((item) => item.name === 'Насосы');
        const phrase = harness.phrases.find((item) => item.category.id === category?.id);

        expect(category?.status).toBe(CategoryStatus.ACTIVE);
        expect(assigned.inquiry.category?.id).toBe(category?.id);
        expect(assigned.inquiry.isPaused).toBe(false);
        expect(phrase?.phrase).toBe('насос');
        expect(assigned.inquiry.status).not.toBe(InquiryStatus.RESEARCHING);
    });

    it('точное имя пакета добавляет только его вопросы к базовым', async () => {
        const harness = buildHarness();
        const category = seedShoes(harness);

        harness.phrasesRepo.create({ category, phrase: 'Спецодежда' });
        const view = await harness.service.create({ telegramUserId: 100, text: 'Спецодежда' });

        expect(view.inquiry.questionPack?.code).toBe('WORKWEAR');
        expect(view.questions.map((question) => question.prompt)).toEqual(['Размер?', 'Ткань?']);
    });

    it('пустой текст и архивная категория не проходят', async () => {
        const harness = buildHarness();
        const archived = harness.categoriesRepo.create({
            name: 'Архив',
            description: 'скрыто',
            status: CategoryStatus.ARCHIVED,
        });
        const created = await harness.service.create({ telegramUserId: 100, text: 'станок' });

        await expect(harness.service.create({ telegramUserId: 100, text: '   ' })).rejects.toBeInstanceOf(
            BadRequestAppException,
        );
        await expect(
            harness.service.assignCategory({
                inquiryId: created.inquiry.id,
                categoryId: archived.id,
                adminUserId: harness.admin.id,
            }),
        ).rejects.toBeInstanceOf(ConflictAppException);
    });

    it('повторное имя категории конфликтует и заявку не снимает с паузы', async () => {
        const harness = buildHarness();

        seedShoes(harness);
        const created = await harness.service.create({ telegramUserId: 100, text: 'насос' });

        await expect(
            harness.service.createCategoryAndAssign({
                inquiryId: created.inquiry.id,
                adminUserId: harness.admin.id,
                name: 'Обувь',
                description: 'другое',
            }),
        ).rejects.toBeInstanceOf(ConflictAppException);

        const reloaded = await harness.service.getById(created.inquiry.id);

        expect(reloaded.inquiry.isPaused).toBe(true);
    });

    it('сохраняет file_id фото и отбрасывает пустые значения', async () => {
        const harness = buildHarness();

        seedShoes(harness);
        const view = await harness.service.create({
            telegramUserId: 100,
            text: 'кроссовки',
            photoFileIds: [' AgACAgIAAxkBAAIB ', '', 'AgACAgIAAxkBAAIB', 'не file id'],
        });

        expect(view.inquiry.photoUrls).toEqual(['AgACAgIAAxkBAAIB']);
    });

    it('записывает ответ и отдаёт следующий вопрос', async () => {
        const harness = buildHarness();
        const category = seedShoes(harness);

        harness.phrasesRepo.create({ category, phrase: 'Спецодежда' });
        const created = await harness.service.create({ telegramUserId: 100, text: 'Спецодежда' });
        const next = await harness.service.answerQuestion({
            inquiryId: created.inquiry.id,
            telegramUserId: 100,
            text: '48',
        });

        expect(next.kind).toBe('asking');

        if (next.kind === 'asking') {
            expect(next.prompt).toBe('Ткань?');
            expect(next.index).toBe(1);
        }
    });

    it('фраза отказа снимает категорию и ставит паузу', async () => {
        const harness = buildHarness();

        seedShoes(harness);
        const created = await harness.service.create({ telegramUserId: 100, text: 'кроссовки' });
        const paused = await harness.service.rejectCategory({
            inquiryId: created.inquiry.id,
            telegramUserId: 100,
        });

        expect(paused.inquiry.isPaused).toBe(true);
        expect(paused.inquiry.category ?? null).toBeNull();
        expect(paused.inquiry.status).toBe(InquiryStatus.AWAITING_CATEGORY);
        expect(paused.inquiry.pauseReason).toContain('не та категория');
        expect(paused.questions).toEqual([]);
        expect(paused.inquiry.status).not.toBe(InquiryStatus.RESEARCHING);

        const reloaded = await harness.service.getById(created.inquiry.id);

        expect(reloaded.inquiry.isPaused).toBe(true);
        expect(reloaded.inquiry.category ?? null).toBeNull();
        expect(reloaded.inquiry.status).toBe(InquiryStatus.AWAITING_CATEGORY);
    });

    it('узнаёт админа по telegram user id и роли', async () => {
        const harness = buildHarness();

        harness.admin.telegramUserId = '501';
        const admin = await harness.service.resolveTelegramActor(501);
        const fresh = await harness.service.resolveTelegramActor(777);
        const recipients = await harness.service.listAdminRecipients();

        expect(admin).toEqual({ kind: 'admin', userId: harness.admin.id, telegramUserId: 501 });
        expect(fresh).toEqual({ kind: 'new_client', telegramUserId: 777 });
        expect(recipients).toEqual([{ userId: harness.admin.id, telegramUserId: 501 }]);
    });

    it('вторая похожая заявка получает карточку без ресерча, другой объём её не берёт', async () => {
        const harness = buildHarness();
        const category = harness.categoriesRepo.create({
            name: 'Халаты',
            description: 'Халаты без цены',
            status: CategoryStatus.ACTIVE,
        });
        const other = harness.categoriesRepo.create({
            name: 'Насосы',
            description: 'Насосы без цены',
            status: CategoryStatus.ACTIVE,
        });

        harness.phrasesRepo.create({ category, phrase: 'халаты' });
        const fabric = harness.questionsRepo.create({
            category,
            questionPack: null,
            prompt: 'Ткань?',
            answerType: QuestionAnswerType.TEXT,
            choices: null,
            isRequired: true,
            sortOrder: 0,
        });
        const qty = harness.questionsRepo.create({
            category,
            questionPack: null,
            prompt: 'Сколько?',
            answerType: QuestionAnswerType.NUMBER,
            choices: null,
            isRequired: true,
            sortOrder: 1,
        });
        const color = harness.questionsRepo.create({
            category,
            questionPack: null,
            prompt: 'Цвет?',
            answerType: QuestionAnswerType.TEXT,
            choices: null,
            isRequired: false,
            sortOrder: 2,
        });
        const product = stamp(new CanonicalProductEntity(), {
            category,
            nameRu: 'Халат хлопок',
            nameZh: null,
            attributes: { [fabric.id]: 'хлопок' },
        });
        const card = harness.cardsRepo.create({
            category,
            canonicalProduct: product,
            qtyMin: '10',
            qtyMax: '100',
            quantityQuestion: qty,
            isLive: true,
            productAttributes: { [fabric.id]: 'хлопок' },
            contactAdminEntered: false,
            expiresAt: new Date('2027-01-01T00:00:00.000Z'),
            markedLiveAt: new Date('2026-11-01T00:00:00.000Z'),
        });

        harness.cardsRepo.create({
            category: other,
            canonicalProduct: product,
            qtyMin: '40',
            qtyMax: '60',
            quantityQuestion: qty,
            isLive: true,
            productAttributes: { [fabric.id]: 'хлопок' },
            contactAdminEntered: false,
            expiresAt: new Date('2027-01-01T00:00:00.000Z'),
            markedLiveAt: new Date('2026-11-02T00:00:00.000Z'),
        });

        const first = await answerGown(harness.service, 100, '50', 'белый');
        const second = await answerGown(harness.service, 200, '50', 'синий');
        const otherVolume = await answerGown(harness.service, 300, '1000', 'белый');

        expect(first.status).toBe(InquiryStatus.SERVED_FROM_DATABASE);
        expect(first.optimalCard?.id).toBe(card.id);

        const storedCard = await harness.service.getById(first.id);

        expect(storedCard.inquiry.status).toBe(InquiryStatus.SERVED_FROM_DATABASE);
        expect(storedCard.inquiry.optimalCard?.id).toBe(card.id);
        expect(second.status).toBe(InquiryStatus.SERVED_FROM_DATABASE);
        expect(second.optimalCard?.id).toBe(card.id);
        expect(otherVolume.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(otherVolume.optimalCard ?? null).toBeNull();
        expect(first.status).not.toBe(InquiryStatus.RESEARCHING);
        expect(second.status).not.toBe(InquiryStatus.RESEARCHING);
        expect(otherVolume.status).not.toBe(InquiryStatus.RESEARCHING);
        expect(color.isRequired).toBe(false);
    });

    it('последний базовый ответ одежды без пакета запускает ресерч', async () => {
        const harness = buildHarness({ launchResearch: true });
        const category = seedClothing(harness);
        const created = await harness.service.create({ telegramUserId: 8604571553, text: 'нужна куртка' });

        await harness.service.assignCategory({
            inquiryId: created.inquiry.id,
            categoryId: category.id,
            adminUserId: harness.admin.id,
        });
        const done = await answerClothing(harness.service, 8604571553, created.inquiry.id);

        expect(done?.kind).toBe('complete');

        if (done?.kind !== 'complete') {
            return;
        }

        expect(done.view.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(done.view.inquiry.id).toBe(created.inquiry.id);
        expect(done.view.inquiry.questionPack ?? null).toBeNull();
        expect(harness.launchCount()).toBe(1);
        expect(harness.answers).toHaveLength(8);
        expect(harness.answers.some((answer) => answer.categoryQuestion?.prompt === CLOTHING_PACK)).toBe(false);

        const reloaded = await harness.service.getById(created.inquiry.id);

        expect(reloaded.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(reloaded.questions.some((question) => question.prompt === CLOTHING_PACK)).toBe(false);
    });

    it('собранная заявка одежды проходит findOne тарифа и запускает ресерч', async () => {
        const harness = buildHarness({ launchResearch: true, tariff: 'repository' });
        const category = seedClothing(harness);
        const created = await harness.service.create({ telegramUserId: 8604571553, text: 'нужна куртка' });

        await harness.service.assignCategory({
            inquiryId: created.inquiry.id,
            categoryId: category.id,
            adminUserId: harness.admin.id,
        });
        const done = await answerClothing(harness.service, 8604571553, created.inquiry.id);

        expect(done?.kind).toBe('complete');

        if (done?.kind !== 'complete') {
            return;
        }

        expect(done.view.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(harness.planFindOne).toHaveBeenCalledWith(PlanEntity, { code: 'free' });
        expect(harness.launchCount()).toBe(1);
        expect(harness.answers).toHaveLength(8);
        expect(harness.inquiries).toHaveLength(1);
    });

    it('сбой запуска не оставляет собранную заявку без повторной попытки', async () => {
        const harness = buildHarness({ launch: 'fail-once' });
        const { inquiryId } = await finishClothing(harness);

        await expect(answerClothing(harness.service, 8604571553, inquiryId)).rejects.toThrow(
            'Не удалось запустить поиск',
        );

        const stuck = await harness.service.getById(inquiryId);

        expect(stuck.inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(harness.answers).toHaveLength(8);
        expect(harness.inquiries).toHaveLength(1);
        expect(harness.launchCount()).toBe(1);

        const resumed = await harness.service.findClientDialog(8604571553);

        expect(resumed.kind).toBe('complete');

        if (resumed.kind !== 'complete') {
            return;
        }

        expect(resumed.view.inquiry.id).toBe(inquiryId);
        expect(resumed.view.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(harness.inquiries).toHaveLength(1);
        expect(harness.launchCount()).toBe(2);
    });

    it('новая пауза не прячет собранную заявку и не требует ответить заново', async () => {
        const harness = buildHarness({ launch: 'fail-once' });
        const { inquiryId } = await finishClothing(harness);

        await expect(answerClothing(harness.service, 8604571553, inquiryId)).rejects.toThrow(
            'Не удалось запустить поиск',
        );

        const paused = await harness.service.create({ telegramUserId: 8604571553, text: 'ещё раз напишите' });

        expect(paused.inquiry.status).toBe(InquiryStatus.AWAITING_CATEGORY);
        expect(paused.inquiry.isPaused).toBe(true);

        const resumed = await harness.service.findClientDialog(8604571553);

        expect(resumed.kind).toBe('complete');

        if (resumed.kind !== 'complete') {
            return;
        }

        expect(resumed.view.inquiry.id).toBe(inquiryId);
        expect(resumed.view.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(harness.inquiries).toHaveLength(2);

        const hidden = await harness.service.getById(paused.inquiry.id);

        expect(hidden.inquiry.status).toBe(InquiryStatus.CLOSED);
        expect(hidden.inquiry.isPaused).toBe(false);
    });

    it('собранная одежда запускается, даже если новее уже заполненная заявка «общее»', async () => {
        const harness = buildHarness({ launch: 'fail-once' });
        const { inquiryId } = await finishClothing(harness);

        await expect(answerClothing(harness.service, 8604571553, inquiryId)).rejects.toThrow(
            'Не удалось запустить поиск',
        );

        const clothing = await harness.service.getById(inquiryId);
        const general = harness.categoriesRepo.create({
            code: 'general',
            name: 'Общее',
            description: 'Назначено вместо паузы',
            status: CategoryStatus.ACTIVE,
        });
        const prompts = [
            'Что это?',
            'Количество',
            'Фото или ссылка (если есть)',
            'Характеристики своими словами',
            'Известная цена',
            'Город доставки',
        ];
        const questions = prompts.map((prompt, index) =>
            harness.questionsRepo.create({
                category: general,
                questionPack: null,
                prompt,
                answerType: index === 1 ? QuestionAnswerType.NUMBER : QuestionAnswerType.TEXT,
                choices: null,
                isRequired: index === 0 || index === 1 || index === 5,
                sortOrder: index + 1,
            }),
        );
        const stray = Object.assign(new InquiryEntity(), {
            status: InquiryStatus.COLLECTING_ANSWERS,
            isPaused: false,
            pauseReason: null,
            rawText: 'ещё раз напишите',
            clientUser: clothing.inquiry.clientUser,
            category: general,
            questionPack: null,
            photoUrls: [],
            createdAt: new Date(Date.now() + 60_000),
            updatedAt: null,
        });

        harness.inquiries.push(stray);

        for (const question of questions) {
            harness.answers.push(
                Object.assign(new InquiryAnswerEntity(), {
                    inquiry: stray,
                    categoryQuestion: question,
                    valueText: 'ответ',
                    valueJson: null,
                    answeredAt: new Date(),
                }),
            );
        }

        const resumed = await harness.service.findClientDialog(8604571553);

        expect(resumed.kind).toBe('complete');

        if (resumed.kind !== 'complete') {
            return;
        }

        expect(resumed.view.inquiry.id).toBe(inquiryId);
        expect(resumed.view.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(stray.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(harness.launchCount()).toBe(2);
        expect(harness.inquiries).toHaveLength(2);
    });

    it('новый незаконченный опрос не вытесняется старой готовой заявкой', async () => {
        const harness = buildHarness({ launch: 'fail-once' });

        seedShoes(harness);
        const first = await harness.service.create({ telegramUserId: 100, text: 'кроссовки' });

        await expect(
            harness.service.answerQuestion({
                inquiryId: first.inquiry.id,
                telegramUserId: 100,
                text: '42',
            }),
        ).rejects.toThrow('Не удалось запустить поиск');

        const second = await harness.service.create({ telegramUserId: 100, text: 'кроссовки' });
        const dialog = await harness.service.findClientDialog(100);

        expect(dialog.kind).toBe('asking');

        if (dialog.kind !== 'asking') {
            return;
        }

        expect(dialog.view.inquiry.id).toBe(second.inquiry.id);
        expect(dialog.prompt).toBe('Размер?');
        expect((await harness.service.getById(first.inquiry.id)).inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(harness.launchCount()).toBe(1);
    });

    it('собранная заявка запускается, если id вопроса в ответе не читается', async () => {
        const harness = buildHarness({ launch: 'fail-once' });
        const { inquiryId } = await finishClothing(harness);

        await expect(answerClothing(harness.service, 8604571553, inquiryId)).rejects.toThrow(
            'Не удалось запустить поиск',
        );

        for (const answer of harness.answers) {
            answer.categoryQuestion = {} as CategoryQuestionEntity;
        }

        const resumed = await harness.service.findClientDialog(8604571553);

        expect(resumed.kind).toBe('complete');

        if (resumed.kind !== 'complete') {
            return;
        }

        expect(resumed.view.inquiry.id).toBe(inquiryId);
        expect(resumed.view.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(harness.launchCount()).toBe(2);
    });
});

const CLOTHING_REPLIES = ['лабораторный халат', '10', 'хлопок', 'M-100%', 'белый', 'нет', '500', 'Москва'];

async function finishClothing(harness: ReturnType<typeof buildHarness>): Promise<{ inquiryId: string }> {
    const category = seedClothing(harness);
    const created = await harness.service.create({ telegramUserId: 8604571553, text: 'нужна куртка' });

    await harness.service.assignCategory({
        inquiryId: created.inquiry.id,
        categoryId: category.id,
        adminUserId: harness.admin.id,
    });

    return { inquiryId: created.inquiry.id };
}

async function answerClothing(
    service: InquiryServiceImpl,
    telegramUserId: number,
    inquiryId: string,
): Promise<ClientDialog | undefined> {
    let last: ClientDialog | undefined;

    for (const text of CLOTHING_REPLIES) {
        last = await service.answerQuestion({ inquiryId, telegramUserId, text });
    }

    return last;
}

async function answerGown(
    service: InquiryServiceImpl,
    telegramUserId: number,
    qty: string,
    color: string,
): Promise<InquiryEntity> {
    const created = await service.create({ telegramUserId, text: 'халаты' });

    await service.answerQuestion({ inquiryId: created.inquiry.id, telegramUserId, text: 'хлопок' });
    await service.answerQuestion({ inquiryId: created.inquiry.id, telegramUserId, text: qty });
    const done = await service.answerQuestion({ inquiryId: created.inquiry.id, telegramUserId, text: color });

    if (done.kind !== 'complete') {
        throw new Error('Заявка не дошла до конца вопросов');
    }

    return done.view.inquiry;
}
