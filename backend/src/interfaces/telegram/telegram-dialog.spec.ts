import { CategoryAdminServiceImpl } from '../../application/services/impls/category/category-admin.service.impl';
import { InquiryServiceImpl } from '../../application/services/impls/inquiry/inquiry.service.impl';
import { TextEmbeddingPort } from '../../application/ports/text-embedding.port';
import { CategoryPhraseEntity } from '../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../domain/entities/category/category-site.entity';
import { CategoryEntity } from '../../domain/entities/category/category.entity';
import { QuestionPackEntity } from '../../domain/entities/category/question-pack.entity';
import { InquiryAnswerEntity } from '../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryEntity } from '../../domain/entities/inquiry/inquiry.entity';
import { OptimalCardEntity } from '../../domain/entities/market/optimal-card.entity';
import { AppUserEntity } from '../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../domain/enums/inquiry-status.enum';
import { QuestionAnswerType } from '../../domain/enums/question-answer-type.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { CategoryPhraseRepository } from '../../domain/repositories/category/category-phrase.repository';
import { CategoryQuestionRepository } from '../../domain/repositories/category/category-question.repository';
import { CategoryRepository } from '../../domain/repositories/category/category.repository';
import { CategorySiteRepository } from '../../domain/repositories/category/category-site.repository';
import { QuestionPackRepository } from '../../domain/repositories/category/question-pack.repository';
import { InquiryAnswerRepository } from '../../domain/repositories/inquiry/inquiry-answer.repository';
import { InquiryRepository } from '../../domain/repositories/inquiry/inquiry.repository';
import { OptimalCardRepository } from '../../domain/repositories/market/optimal-card.repository';
import { AppUserRepository } from '../../domain/repositories/user/app-user.repository';
import { TelegramDialog } from './telegram-dialog';
import { TelegramButton, TelegramIncoming, TelegramOutgoing } from './telegram.types';

const CLIENT = 777;
const ADMIN = 501;
const PHOTO = 'AgACAgIAAxkBAAIB';
const PRICE = /цена|стоимость|\bруб\b|¥|\$/i;

type Stored = { id: string };

function buildBot() {
    const users: AppUserEntity[] = [];
    const categories: CategoryEntity[] = [];
    const phrases: CategoryPhraseEntity[] = [];
    const packs: QuestionPackEntity[] = [];
    const questions: CategoryQuestionEntity[] = [];
    const sites: CategorySiteEntity[] = [];
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
                const entity = Object.assign(new Ctor(), data) as T & { createdAt?: Date; updatedAt?: Date | null };

                if (!entity.createdAt) {
                    entity.createdAt = new Date();
                }

                if (entity.updatedAt === undefined) {
                    entity.updatedAt = null;
                }

                return entity;
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
    const embedder: TextEmbeddingPort = {
        async embed() {
            return { vector: [1], stub: true };
        },
    };
    const categoryRepo = repo(CategoryEntity, categories);
    const packRepo = repo(QuestionPackEntity, packs);
    const questionRepo = repo(CategoryQuestionEntity, questions);
    const siteRepo = repo(CategorySiteEntity, sites);
    const userRepo = repo(AppUserEntity, users);
    const limitChecker = {
        canStartResearch: jest.fn().mockResolvedValue({ allowed: true }),
        incrementResearchUsage: jest.fn().mockResolvedValue(undefined),
    };
    const inquiriesService = new InquiryServiceImpl(
        repo(InquiryEntity, inquiries) as unknown as InquiryRepository,
        userRepo as unknown as AppUserRepository,
        categoryRepo as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        packRepo as unknown as QuestionPackRepository,
        questionRepo as unknown as CategoryQuestionRepository,
        repo(InquiryAnswerEntity, answers) as unknown as InquiryAnswerRepository,
        repo(OptimalCardEntity, cards) as unknown as OptimalCardRepository,
        embedder,
        limitChecker as any,
    );
    const categoryService = new CategoryAdminServiceImpl(
        categoryRepo as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        packRepo as unknown as QuestionPackRepository,
        questionRepo as unknown as CategoryQuestionRepository,
        siteRepo as unknown as CategorySiteRepository,
    );
    const planManager = {
        changePlan: jest.fn(),
        getUserPlanInfo: jest.fn(),
    };
    const sent: TelegramOutgoing[] = [];
    const dialog = new TelegramDialog(inquiriesService, categoryService, planManager as any, {
        deliver(message) {
            sent.push(message);

            return Promise.resolve();
        },
    });
    const admin = userRepo.create({
        role: UserRole.ADMIN,
        telegramUserId: String(ADMIN),
        login: 'admin',
        passwordHash: 'hash',
        displayName: 'Админ',
        isActive: true,
    });

    em.persist(admin);

    function category(name: string, phrase: string | null, prompts: string[]) {
        const entity = categoryRepo.create({
            name,
            description: `${name} без цены`,
            status: CategoryStatus.ACTIVE,
            embedding: null,
        });

        em.persist(entity);

        if (phrase) {
            em.persist(phraseRepo.create({ category: entity, phrase, embedding: null }));
        }

        prompts.forEach((prompt, sortOrder) => {
            em.persist(
                questionRepo.create({
                    category: entity,
                    questionPack: null,
                    prompt,
                    answerType: QuestionAnswerType.TEXT,
                    choices: null,
                    isRequired: true,
                    sortOrder,
                }),
            );
        });

        return entity;
    }

    return { dialog, sent, inquiries, sites, category };
}

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

function clientText(text: string | null, photoFileIds: string[] = []): TelegramIncoming {
    return { kind: 'message', chatId: CLIENT, telegramUserId: CLIENT, text, photoFileIds };
}

function adminText(text: string): TelegramIncoming {
    return { kind: 'message', chatId: ADMIN, telegramUserId: ADMIN, text, photoFileIds: [] };
}

function press(telegramUserId: number, data: string): TelegramIncoming {
    return {
        kind: 'callback',
        chatId: telegramUserId,
        telegramUserId,
        callbackQueryId: `cb-${data}`,
        data,
    };
}

function messages(sent: TelegramOutgoing[], chatId: number): string[] {
    return sent.flatMap((item) => (item.method === 'sendMessage' && item.chatId === chatId ? [item.text] : []));
}

function buttons(sent: TelegramOutgoing[], chatId: number): TelegramButton[] {
    return sent.flatMap((item) => {
        if (item.method !== 'sendMessage' || item.chatId !== chatId) {
            return [];
        }

        return (item.buttons ?? []).flat();
    });
}

describe('TelegramDialog', () => {
    it('уверенный текст называет категорию и задаёт вопросы по одному', async () => {
        const bot = buildBot();

        bot.category('Халаты', 'халат', ['Какая ткань?', 'Сколько штук?']);
        await bot.dialog.handle(clientText('халат'));

        const first = messages(bot.sent, CLIENT).join('\n');

        expect(first).toContain('Отнёс к категории «Халаты»');
        expect(first).toContain('Какая ткань?');
        expect(first).not.toContain('Сколько штук?');
        expect(first).not.toMatch(PRICE);
        expect(messages(bot.sent, ADMIN)).toEqual([]);
        expect(bot.inquiries.some((inquiry) => inquiry.status === InquiryStatus.RESEARCHING)).toBe(false);

        await bot.dialog.handle(clientText('хлопок'));
        const second = messages(bot.sent, CLIENT).at(-1) ?? '';

        expect(second).toContain('Сколько штук?');
        expect(second).not.toContain('Какая ткань?');
        expect(second).not.toMatch(PRICE);

        await bot.dialog.handle(clientText('20'));

        expect(messages(bot.sent, CLIENT).at(-1)).toBe('Ответы записаны. Дальше считает менеджер.');
        expect(messages(bot.sent, CLIENT).join('\n')).not.toMatch(PRICE);
        expect(bot.inquiries.some((inquiry) => inquiry.status === InquiryStatus.RESEARCHING)).toBe(false);
    });

    it('сомнение останавливает клиента и даёт админу фото и кнопку категории', async () => {
        const bot = buildBot();

        bot.category('Насосы', 'насос', ['Какой напор?']);
        bot.category('Помпы', 'насос', ['Для чего насос?']);
        await bot.dialog.handle(clientText('насос', [PHOTO]));

        expect(messages(bot.sent, CLIENT).join('\n')).toContain('Менеджер уточняет направление.');
        expect(messages(bot.sent, CLIENT).join('\n')).not.toMatch(PRICE);
        expect(bot.sent.some((item) => item.method === 'sendPhoto' && item.chatId === ADMIN && item.fileId === PHOTO)).toBe(
            true,
        );

        const adminButtons = buttons(bot.sent, ADMIN);
        const assign = adminButtons.find((button) => button.text === 'Насосы');
        const other = adminButtons.find((button) => button.text === 'Другая категория');

        expect(assign?.callbackData.startsWith('a:')).toBe(true);
        expect(adminButtons.some((button) => button.text === 'Помпы')).toBe(true);
        expect(other).toBeDefined();
        expect(bot.inquiries[0]?.isPaused).toBe(true);
        expect(bot.inquiries[0]?.status).not.toBe(InquiryStatus.RESEARCHING);

        await bot.dialog.handle(press(CLIENT, assign?.callbackData ?? ''));

        expect(messages(bot.sent, CLIENT).at(-1)).toContain('Это действие для админа.');
        expect(bot.inquiries[0]?.category ?? null).toBeNull();

        await bot.dialog.handle(press(ADMIN, other?.callbackData ?? ''));

        expect(buttons(bot.sent, ADMIN).some((button) => button.text === 'Насосы' && button.callbackData.startsWith('p:'))).toBe(
            true,
        );

        await bot.dialog.handle(press(ADMIN, assign?.callbackData ?? ''));

        const told = messages(bot.sent, CLIENT).at(-1) ?? '';

        expect(told).toContain('Отнёс к категории «Насосы»');
        expect(told).toContain('Какой напор?');
        expect(told).not.toMatch(PRICE);
        expect(bot.inquiries[0]?.isPaused).toBe(false);
        expect(bot.inquiries[0]?.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
    });

    it('фраза «это не та категория» возвращает заявку в паузу и зовёт админа', async () => {
        const bot = buildBot();

        bot.category('Халаты', 'халат', ['Какая ткань?']);
        await bot.dialog.handle(clientText('халат'));
        await bot.dialog.handle(clientText('Это не та категория!'));

        expect(messages(bot.sent, CLIENT).at(-1)).toBe('Менеджер уточняет направление.');
        expect(bot.inquiries[0]?.isPaused).toBe(true);
        expect(bot.inquiries[0]?.category ?? null).toBeNull();
        expect(buttons(bot.sent, ADMIN).some((button) => button.text === 'Халаты')).toBe(true);
        expect(messages(bot.sent, ADMIN).join('\n')).toContain('халат');
        expect(messages(bot.sent, CLIENT).join('\n')).not.toMatch(PRICE);
    });

    it('новая категория в боте создаёт вопрос и площадку и задаёт вопрос клиенту', async () => {
        const bot = buildBot();

        bot.category('Халаты', 'халат', ['Какая ткань?']);
        await bot.dialog.handle(clientText('станок'));

        const create = buttons(bot.sent, ADMIN).find((button) => button.text === 'Новая категория');

        await bot.dialog.handle(press(ADMIN, create?.callbackData ?? ''));
        await bot.dialog.handle(adminText('Станки'));
        await bot.dialog.handle(adminText('Металлообработка без цены'));
        await bot.dialog.handle(adminText('Какая модель?'));
        await bot.dialog.handle(press(ADMIN, 'sr:f'));
        await bot.dialog.handle(adminText('1688'));

        const told = messages(bot.sent, CLIENT).at(-1) ?? '';

        expect(told).toContain('Отнёс к категории «Станки»');
        expect(told).toContain('Какая модель?');
        expect(told).not.toMatch(PRICE);
        expect(bot.sites.map((site) => site.name)).toEqual(['1688']);
        expect(bot.sites[0]?.siteRole).toBe('FACTORY_CONTACT');
        expect(bot.inquiries[0]?.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(bot.inquiries[0]?.status).not.toBe(InquiryStatus.RESEARCHING);
    });
});
