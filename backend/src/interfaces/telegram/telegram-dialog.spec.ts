import { CategoryAdminServiceImpl } from '../../application/services/impls/category/category-admin.service.impl';
import { InquiryServiceImpl } from '../../application/services/impls/inquiry/inquiry.service.impl';
import { LimitCheckerServiceImpl } from '../../application/services/impls/tariff/limit-checker.service.impl';
import { CategoryPhraseEntity } from '../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../domain/entities/category/category-site.entity';
import { CategoryEntity } from '../../domain/entities/category/category.entity';
import { QuestionPackEntity } from '../../domain/entities/category/question-pack.entity';
import { InquiryAnswerEntity } from '../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryEntity } from '../../domain/entities/inquiry/inquiry.entity';
import { OptimalCardEntity } from '../../domain/entities/market/optimal-card.entity';
import { DailyUsageEntity } from '../../domain/entities/tariff/daily-usage.entity';
import { PlanEntity } from '../../domain/entities/tariff/plan.entity';
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
import { DailyUsageRepository } from '../../domain/repositories/tariff/daily-usage.repository';
import { PlanRepository } from '../../domain/repositories/tariff/plan.repository';
import { AppUserRepository } from '../../domain/repositories/user/app-user.repository';
import { TelegramDialog } from './telegram-dialog';
import { TelegramButton, TelegramIncoming, TelegramOutgoing } from './telegram.types';

const CLIENT = 777;
const ADMIN = 501;
const PHOTO = 'AgACAgIAAxkBAAIB';
const PRICE = /цена|стоимость|\bруб\b|¥|\$/i;
const STALE_INQUIRY_ID = '11111111-1111-4111-8111-111111111111';
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

type Stored = { id: string };

function buildBot(options?: { dailyResearchLimit?: number; researchCount?: number }) {
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

    const phraseRepo = {
        ...repo(CategoryPhraseEntity, phrases),
        findByCategoryStatus(status: CategoryStatus) {
            return Promise.resolve(phrases.filter((phrase) => phrase.category.status === status));
        },
    };
    const categoryRepo = repo(CategoryEntity, categories);
    const packRepo = repo(QuestionPackEntity, packs);
    const questionRepo = repo(CategoryQuestionEntity, questions);
    const siteRepo = repo(CategorySiteEntity, sites);
    const userRepo = repo(AppUserEntity, users);
    const usages: DailyUsageEntity[] = [];
    const limitChecker = buildLimitChecker(users, usages, options);
    const inquiriesService = new InquiryServiceImpl(
        repo(InquiryEntity, inquiries) as unknown as InquiryRepository,
        userRepo as unknown as AppUserRepository,
        categoryRepo as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        packRepo as unknown as QuestionPackRepository,
        questionRepo as unknown as CategoryQuestionRepository,
        repo(InquiryAnswerEntity, answers) as unknown as InquiryAnswerRepository,
        repo(OptimalCardEntity, cards) as unknown as OptimalCardRepository,
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
        displayName: 'Админ',
        isActive: true,
    });

    em.persist(admin);

    function category(name: string, phrase: string | null, prompts: string[]) {
        const entity = categoryRepo.create({
            name,
            description: `${name} без цены`,
            status: CategoryStatus.ACTIVE,
        });

        em.persist(entity);

        if (phrase) {
            em.persist(phraseRepo.create({ category: entity, phrase }));
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

    function pack(category: CategoryEntity, code: string, title: string, prompts: string[]) {
        const entity = packRepo.create({
            category,
            code,
            title,
            description: title,
            sortOrder: 0,
            isActive: true,
        });

        em.persist(entity);
        prompts.forEach((prompt, sortOrder) => {
            em.persist(
                questionRepo.create({
                    category,
                    questionPack: entity,
                    prompt,
                    answerType: QuestionAnswerType.SINGLE_CHOICE,
                    choices: ['Многоразовый', 'Одноразовый'],
                    isRequired: true,
                    sortOrder,
                }),
            );
        });

        return entity;
    }

    return { dialog, sent, inquiries, sites, category, pack, usages };
}

function detach<T extends Stored>(entity: T): T {
    return Object.assign(Object.create(Object.getPrototypeOf(entity)), entity);
}

function buildLimitChecker(
    users: AppUserEntity[],
    usages: DailyUsageEntity[],
    options?: { dailyResearchLimit?: number; researchCount?: number },
) {
    if (options?.dailyResearchLimit === undefined) {
        return {
            canStartResearch: jest.fn().mockResolvedValue({ allowed: true }),
            incrementResearchUsage: jest.fn().mockResolvedValue(undefined),
        };
    }

    const plan = Object.assign(new PlanEntity(), {
        code: 'free',
        title: 'Бесплатный',
        dailyResearchLimit: options.dailyResearchLimit,
    });
    const plans: Pick<PlanRepository, 'findByCode'> = {
        async findByCode(code: string) {
            return code === plan.code ? plan : null;
        },
    };
    const userRepo: Pick<AppUserRepository, 'findOne'> = {
        async findOne(where) {
            const id = (where as { id?: string }).id;

            return users.find((user) => user.id === id) ?? null;
        },
    };
    const dailyUsage: Pick<DailyUsageRepository, 'findOrCreate' | 'incrementResearchCount'> = {
        async findOrCreate(userId: string, usageDate: string) {
            const existing = usages.find((row) => row.user.id === userId && row.usageDate === usageDate);

            if (existing) {
                return existing;
            }

            const user = users.find((item) => item.id === userId);

            if (!user) {
                throw new Error(`Нет пользователя ${userId}`);
            }

            const row = Object.assign(new DailyUsageEntity(), {
                user,
                usageDate,
                researchCount: options.researchCount ?? 0,
            });

            usages.push(row);

            return row;
        },
        async incrementResearchCount(userId: string, usageDate: string) {
            const row = await this.findOrCreate(userId, usageDate);

            row.researchCount += 1;
        },
    };

    return new LimitCheckerServiceImpl(
        userRepo as AppUserRepository,
        plans as PlanRepository,
        dailyUsage as DailyUsageRepository,
    );
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
        expect(
            bot.sent.some((item) => item.method === 'sendPhoto' && item.chatId === ADMIN && item.fileId === PHOTO),
        ).toBe(true);

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

        expect(
            buttons(bot.sent, ADMIN).some((button) => button.text === 'Насосы' && button.callbackData.startsWith('p:')),
        ).toBe(true);

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

    it('исчерпанный бесплатный лимит пишет клиенту про лимит и не зовёт админа выбирать категорию', async () => {
        const bot = buildBot({ dailyResearchLimit: 3, researchCount: 3 });

        bot.category('Халаты', 'халат', ['Сколько штук?']);
        await bot.dialog.handle(clientText('халат'));
        await bot.dialog.handle(clientText('1000'));

        const told = messages(bot.sent, CLIENT).join('\n');

        expect(told).toContain('Исчерпан дневной лимит запросов. Попробуйте завтра или обратитесь к менеджеру.');
        expect(told).not.toMatch(PRICE);
        expect(told).not.toContain('Менеджер уточняет направление.');
        expect(messages(bot.sent, ADMIN)).toEqual([]);
        expect(buttons(bot.sent, ADMIN)).toEqual([]);
        expect(bot.inquiries).toHaveLength(1);
        expect(bot.inquiries[0]?.status).toBe(InquiryStatus.LIMIT_EXCEEDED);
        expect(bot.inquiries[0]?.status).not.toBe(InquiryStatus.AWAITING_CATEGORY);
        expect(bot.usages).toHaveLength(1);
        expect(bot.usages[0]?.researchCount).toBe(3);
    });

    it('после назначения «Одежда» клиенту задают базовые вопросы, не пакет', async () => {
        const bot = buildBot();
        const clothing = bot.category('Одежда', null, CLOTHING_BASE);

        bot.pack(clothing, 'workwear', 'Спецодежда и лабораторные халаты', [CLOTHING_PACK]);
        await bot.dialog.handle(clientText('нужна куртка'));

        const list = buttons(bot.sent, ADMIN).find((button) => button.text === 'Другая категория');

        await bot.dialog.handle(press(ADMIN, list?.callbackData ?? ''));

        const pick = buttons(bot.sent, ADMIN).find(
            (button) => button.text === 'Одежда' && button.callbackData.startsWith('p:'),
        );

        await bot.dialog.handle(press(ADMIN, pick?.callbackData ?? ''));

        const told = messages(bot.sent, CLIENT).at(-1) ?? '';

        expect(messages(bot.sent, ADMIN).at(-1)).toBe('Категория назначена: Одежда');
        expect(told).toContain('Отнёс к категории «Одежда»');
        expect(told).toContain('Вопрос 1 из 8');
        expect(told).toContain(CLOTHING_BASE[0]);
        expect(told).not.toContain('Вопросов нет');
        expect(told).not.toContain(CLOTHING_PACK);
        expect(told).not.toMatch(PRICE);
        expect(bot.inquiries[0]?.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        expect(bot.inquiries[0]?.isPaused).toBe(false);
        expect(bot.inquiries[0]?.category?.name).toBe('Одежда');
        expect(bot.inquiries[0]?.questionPack ?? null).toBeNull();

        await bot.dialog.handle(clientText('халат лабораторный'));

        const second = messages(bot.sent, CLIENT).at(-1) ?? '';

        expect(second).toContain('Вопрос 2 из 8');
        expect(second).toContain(CLOTHING_BASE[1]);
        expect(second).not.toContain('Менеджер уточняет направление.');
        expect(second).not.toContain(CLOTHING_PACK);
    });

    it('устаревшая пауза в базе не подменяет вопросы, которые уже вернул assignCategory', async () => {
        const questions = CLOTHING_BASE.map((prompt, sortOrder) =>
            Object.assign(new CategoryQuestionEntity(), {
                prompt,
                choices: null,
                answerType: QuestionAnswerType.TEXT,
                sortOrder,
                isRequired: true,
            }),
        );
        const assigned = Object.assign(new InquiryEntity(), {
            id: STALE_INQUIRY_ID,
            status: InquiryStatus.COLLECTING_ANSWERS,
            isPaused: false,
            rawText: 'нужна куртка',
            category: Object.assign(new CategoryEntity(), { name: 'Одежда' }),
            clientUser: Object.assign(new AppUserEntity(), { telegramUserId: String(CLIENT), role: UserRole.CLIENT }),
            questionPack: null,
        });
        const paused = Object.assign(new InquiryEntity(), {
            id: STALE_INQUIRY_ID,
            status: InquiryStatus.AWAITING_CATEGORY,
            isPaused: true,
            rawText: 'нужна куртка',
            category: null,
            clientUser: assigned.clientUser,
        });
        const findClientDialog = jest.fn().mockResolvedValue({
            kind: 'paused',
            view: { inquiry: paused, questions: [] },
        });
        const sent: TelegramOutgoing[] = [];
        const dialog = new TelegramDialog(
            {
                resolveTelegramActor: async () => ({ kind: 'admin', userId: 'admin', telegramUserId: ADMIN }),
                getById: async () => ({
                    inquiry: Object.assign(new InquiryEntity(), {
                        id: STALE_INQUIRY_ID,
                        classificationScores: {
                            outcome: 'no_match',
                            stub: false,
                            candidates: [
                                {
                                    categoryId: '22222222-2222-4222-8222-222222222222',
                                    categoryName: 'Одежда',
                                    score: 0,
                                    matchedBy: 'keyword',
                                },
                            ],
                        },
                    }),
                    questions: [],
                }),
                assignCategory: async () => ({ inquiry: assigned, questions }),
                findClientDialog,
            } as any,
            {} as any,
            {} as any,
            {
                deliver(message) {
                    sent.push(message);

                    return Promise.resolve();
                },
            },
        );

        await dialog.handle(press(ADMIN, `a:${STALE_INQUIRY_ID}:0`));

        const told = messages(sent, CLIENT).at(-1) ?? '';

        expect(findClientDialog).toHaveBeenCalledWith(CLIENT);
        expect(told).toContain('Отнёс к категории «Одежда»');
        expect(told).toContain('Вопрос 1 из 8');
        expect(told).toContain(CLOTHING_BASE[0]);
        expect(told).not.toContain('Вопросов нет');
        expect(told).not.toContain(CLOTHING_PACK);
    });

    it('если вопросов нет и заявка уже в ресерче, клиенту пишут что заявка принята', async () => {
        const assigned = Object.assign(new InquiryEntity(), {
            id: STALE_INQUIRY_ID,
            status: InquiryStatus.RESEARCHING,
            isPaused: false,
            rawText: 'редкая вещь',
            category: Object.assign(new CategoryEntity(), { name: 'Пустая' }),
            clientUser: Object.assign(new AppUserEntity(), { telegramUserId: String(CLIENT), role: UserRole.CLIENT }),
        });
        const sent: TelegramOutgoing[] = [];
        const dialog = new TelegramDialog(
            {
                resolveTelegramActor: async () => ({ kind: 'admin', userId: 'admin', telegramUserId: ADMIN }),
                getById: async () => ({
                    inquiry: Object.assign(new InquiryEntity(), {
                        id: STALE_INQUIRY_ID,
                        classificationScores: {
                            outcome: 'no_match',
                            stub: false,
                            candidates: [
                                {
                                    categoryId: '22222222-2222-4222-8222-222222222222',
                                    categoryName: 'Пустая',
                                    score: 0,
                                    matchedBy: 'keyword',
                                },
                            ],
                        },
                    }),
                    questions: [],
                }),
                assignCategory: async () => ({ inquiry: assigned, questions: [] }),
                findClientDialog: async () => ({
                    kind: 'paused',
                    view: { inquiry: assigned, questions: [] },
                }),
            } as any,
            {} as any,
            {} as any,
            {
                deliver(message) {
                    sent.push(message);

                    return Promise.resolve();
                },
            },
        );

        await dialog.handle(press(ADMIN, `a:${STALE_INQUIRY_ID}:0`));

        expect(messages(sent, CLIENT).at(-1)).toBe('Заявка принята, менеджер скоро ответит');
        expect(messages(sent, CLIENT).join('\n')).not.toContain('Вопросов нет');
    });
});
