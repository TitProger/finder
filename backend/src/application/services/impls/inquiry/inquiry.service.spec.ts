import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { InquiryAnswerEntity } from '../../../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
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
        const view = await harness.service.create({ text: '  Кроссовки  ' });

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
        const view = await harness.service.create({ text: 'нужен станок' });

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
        const created = await harness.service.create({ text: 'нужен станок' });
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

        const again = await harness.service.create({ text: 'нужен станок' });

        expect(again.inquiry.category?.id).toBe(category.id);
        expect(again.inquiry.isPaused).toBe(false);
    });

    it('назначение «Одежда» переживает повторную загрузку и берёт только базовые вопросы', async () => {
        const harness = buildHarness();
        const category = seedClothing(harness);
        const created = await harness.service.create({ text: 'нужна куртка' });
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
        const created = await harness.service.create({ text: 'workwear' });
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
        const created = await harness.service.create({ text: 'редкая вещь' });
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
        const created = await harness.service.create({ text: 'насос' });
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
        const view = await harness.service.create({ text: 'Спецодежда' });

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
        const created = await harness.service.create({ text: 'станок' });

        await expect(harness.service.create({ text: '   ' })).rejects.toBeInstanceOf(
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
        const created = await harness.service.create({ text: 'насос' });

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

    it('сохраняет непрозрачные id фото и отбрасывает пустые значения', async () => {
        const harness = buildHarness();

        seedShoes(harness);
        const view = await harness.service.create({
            text: 'кроссовки',
            photoFileIds: [' AgACAgIAAxkBAAIB ', '', 'AgACAgIAAxkBAAIB', 'не file id'],
        });

        expect(view.inquiry.photoUrls).toEqual(['AgACAgIAAxkBAAIB']);
    });
});
