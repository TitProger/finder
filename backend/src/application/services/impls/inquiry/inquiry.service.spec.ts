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

function buildHarness() {
    const users: AppUserEntity[] = [];
    const categories: CategoryEntity[] = [];
    const phrases: CategoryPhraseEntity[] = [];
    const packs: QuestionPackEntity[] = [];
    const questions: CategoryQuestionEntity[] = [];
    const inquiries: InquiryEntity[] = [];
    const answers: InquiryAnswerEntity[] = [];
    const cards: OptimalCardEntity[] = [];
    const lists = new Map<object, Stored[]>();
    const em = {
        persist(entity: Stored) {
            const list = lists.get(entity.constructor);

            if (!list) {
                throw new Error(`Нет списка для ${entity.constructor.name}`);
            }

            if (!list.includes(entity)) {
                list.push(entity);
            }

            return em;
        },
        remove(entity: Stored) {
            const list = lists.get(entity.constructor);
            const index = list?.indexOf(entity) ?? -1;

            if (list && index >= 0) {
                list.splice(index, 1);
            }

            return em;
        },
        async flush() {
            return undefined;
        },
        async persistAndFlush(entity: Stored) {
            em.persist(entity);
        },
    };

    function repo<T extends Stored>(Ctor: new () => T, items: T[]) {
        lists.set(Ctor, items);

        return {
            create(data: object) {
                return stamp(new Ctor(), data);
            },
            find(where: Record<string, unknown>) {
                return Promise.resolve(items.filter((item) => matches(item, where)));
            },
            findOne(where: Record<string, unknown>) {
                return Promise.resolve(items.find((item) => matches(item, where)) ?? null);
            },
            getEntityManager() {
                return em;
            },
        };
    }

    const phraseRepo = {
        ...repo(CategoryPhraseEntity, phrases),
        findByCategoryStatus(status: CategoryStatus) {
            return Promise.resolve(phrases.filter((phrase) => phrase.category.status === status));
        },
    };
    const limitChecker = {
        canStartResearch: jest.fn().mockResolvedValue({ allowed: true }),
        incrementResearchUsage: jest.fn().mockResolvedValue(undefined),
    };
    const service = new InquiryServiceImpl(
        repo(InquiryEntity, inquiries) as unknown as InquiryRepository,
        repo(AppUserEntity, users) as unknown as AppUserRepository,
        repo(CategoryEntity, categories) as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        repo(QuestionPackEntity, packs) as unknown as QuestionPackRepository,
        repo(CategoryQuestionEntity, questions) as unknown as CategoryQuestionRepository,
        repo(InquiryAnswerEntity, answers) as unknown as InquiryAnswerRepository,
        repo(OptimalCardEntity, cards) as unknown as OptimalCardRepository,
        limitChecker as any,
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
    };
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
        expect(second.status).toBe(InquiryStatus.SERVED_FROM_DATABASE);
        expect(second.optimalCard?.id).toBe(card.id);
        expect(otherVolume.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(otherVolume.optimalCard ?? null).toBeNull();
        expect(first.status).not.toBe(InquiryStatus.RESEARCHING);
        expect(second.status).not.toBe(InquiryStatus.RESEARCHING);
        expect(otherVolume.status).not.toBe(InquiryStatus.RESEARCHING);
        expect(color.isRequired).toBe(false);
    });
});

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
