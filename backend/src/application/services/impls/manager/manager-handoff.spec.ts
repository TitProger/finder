import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../../../domain/entities/category/category-site.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { CanonicalProductEntity } from '../../../../domain/entities/catalog/canonical-product.entity';
import { CompanyContactEntity } from '../../../../domain/entities/catalog/company-contact.entity';
import { CompanyEntity } from '../../../../domain/entities/catalog/company.entity';
import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { InquiryAnswerEntity } from '../../../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { DailyUsageEntity } from '../../../../domain/entities/tariff/daily-usage.entity';
import { PlanEntity } from '../../../../domain/entities/tariff/plan.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { MarketPriceLayer } from '../../../../domain/enums/market-price-layer.enum';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { CompanyContactRepository } from '../../../../domain/repositories/catalog/company-contact.repository';
import { CompanyRepository } from '../../../../domain/repositories/catalog/company.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { CanonicalProductRepository } from '../../../../domain/repositories/catalog/canonical-product.repository';
import { CategoryPhraseRepository } from '../../../../domain/repositories/category/category-phrase.repository';
import { CategoryQuestionRepository } from '../../../../domain/repositories/category/category-question.repository';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { CategorySiteRepository } from '../../../../domain/repositories/category/category-site.repository';
import { QuestionPackRepository } from '../../../../domain/repositories/category/question-pack.repository';
import { InquiryAnswerRepository } from '../../../../domain/repositories/inquiry/inquiry-answer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { OptimalCardRepository } from '../../../../domain/repositories/market/optimal-card.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { DailyUsageRepository } from '../../../../domain/repositories/tariff/daily-usage.repository';
import { PlanRepository } from '../../../../domain/repositories/tariff/plan.repository';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { ManagerNotifyPort } from '../../../ports/manager-notify.port';
import { GrokWebhookTrigger } from '../../../../infrastructure/research/grok-webhook.trigger';
import { TelegramButton, TelegramIncoming, TelegramOutgoing } from '../../../../interfaces/telegram/telegram.types';
import { TelegramDialog } from '../../../../interfaces/telegram/telegram-dialog';
import { InquiryServiceImpl } from '../inquiry/inquiry.service.impl';
import { OptimalCardServiceImpl } from '../market/optimal-card.service.impl';
import { LimitCheckerServiceImpl } from '../tariff/limit-checker.service.impl';
import { JsonResearchRunner } from '../research/json-research-runner';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { ResearchLaunchService } from '../research/research-launch.service';
import { ManagerHandoffService } from './manager-handoff.service';

const CLIENT = 777001;
const ADMINS = [111000111, 222000222] as const;
const TEXT = 'халат';
const CLIENT_PRICE = /\d+(?:[.,]\d+)?\s*(?:CNY|USD|RUB|руб\.?|¥|\$)/i;
const CHEAP_URL = 'https://detail.1688.com/offer/cheap.html';
const DEAR_URL = 'https://detail.1688.com/offer/dear.html';

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

function build(options?: { notify?: ManagerNotifyPort; liveCard?: boolean }) {
    const users: AppUserEntity[] = [];
    const categories: CategoryEntity[] = [];
    const phrases: CategoryPhraseEntity[] = [];
    const packs: QuestionPackEntity[] = [];
    const questions: CategoryQuestionEntity[] = [];
    const sites: CategorySiteEntity[] = [];
    const inquiries: InquiryEntity[] = [];
    const answers: InquiryAnswerEntity[] = [];
    const cards: OptimalCardEntity[] = [];
    const runs: ResearchRunEntity[] = [];
    const companies: CompanyEntity[] = [];
    const contacts: CompanyContactEntity[] = [];
    const offers: OfferEntity[] = [];
    const products: CanonicalProductEntity[] = [];
    const usages: DailyUsageEntity[] = [];
    const sent: TelegramOutgoing[] = [];
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
        async transactional<T>(work: (tx: typeof em) => Promise<T>) {
            return work(em);
        },
    };

    function repo<T extends Stored>(Ctor: new () => T, items: T[]) {
        lists.set(Ctor, items);

        return {
            create(data: object) {
                return stamp(new Ctor(), data);
            },
            find(where: Record<string, unknown> = {}) {
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
    const plan = stamp(new PlanEntity(), { code: 'free', title: 'Бесплатный', dailyResearchLimit: 3 });
    const plans: Pick<PlanRepository, 'findByCode'> = {
        async findByCode(code: string) {
            return code === plan.code ? plan : null;
        },
    };
    const userRepo = repo(AppUserEntity, users);
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

            const row = stamp(new DailyUsageEntity(), { user, usageDate, researchCount: 0 });

            usages.push(row);

            return row;
        },
        async incrementResearchCount(userId: string, usageDate: string) {
            const row = await this.findOrCreate(userId, usageDate);

            row.researchCount += 1;
        },
    };
    const limitChecker = new LimitCheckerServiceImpl(
        userRepo as unknown as AppUserRepository,
        plans as PlanRepository,
        dailyUsage as DailyUsageRepository,
    );
    const inquiryRepo = repo(InquiryEntity, inquiries);
    const answerRepo = repo(InquiryAnswerEntity, answers);
    const questionRepo = repo(CategoryQuestionEntity, questions);
    const categoryRepo = repo(CategoryEntity, categories);
    const offerRepo = repo(OfferEntity, offers);
    const runRepo = repo(ResearchRunEntity, runs);
    const cardRepo = repo(OptimalCardEntity, cards);
    const notify: ManagerNotifyPort = options?.notify ?? {
        async send(chatId, text, buttons) {
            sent.push({ method: 'sendMessage', chatId, text, buttons });
        },
    };
    const cardsService = new OptimalCardServiceImpl(
        cardRepo as unknown as OptimalCardRepository,
        categoryRepo as unknown as CategoryRepository,
        questionRepo as unknown as CategoryQuestionRepository,
        repo(CanonicalProductEntity, products) as unknown as CanonicalProductRepository,
        offerRepo as unknown as OfferRepository,
        userRepo as unknown as AppUserRepository,
    );
    const handoff = new ManagerHandoffService(
        inquiryRepo as unknown as InquiryRepository,
        answerRepo as unknown as InquiryAnswerRepository,
        questionRepo as unknown as CategoryQuestionRepository,
        offerRepo as unknown as OfferRepository,
        runRepo as unknown as ResearchRunRepository,
        cardRepo as unknown as OptimalCardRepository,
        userRepo as unknown as AppUserRepository,
        cardsService,
        notify,
    );
    const launch = new ResearchLaunchService(
        inquiryRepo as unknown as InquiryRepository,
        answerRepo as unknown as InquiryAnswerRepository,
        repo(CategorySiteEntity, sites) as unknown as CategorySiteRepository,
        runRepo as unknown as ResearchRunRepository,
        new GrokWebhookTrigger(),
        handoff,
    );
    const service = new InquiryServiceImpl(
        inquiryRepo as unknown as InquiryRepository,
        userRepo as unknown as AppUserRepository,
        categoryRepo as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        repo(QuestionPackEntity, packs) as unknown as QuestionPackRepository,
        questionRepo as unknown as CategoryQuestionRepository,
        answerRepo as unknown as InquiryAnswerRepository,
        cardRepo as unknown as OptimalCardRepository,
        limitChecker,
        undefined,
        launch,
        handoff,
    );
    const runner = new JsonResearchRunner(
        inquiryRepo as unknown as InquiryRepository,
        repo(CompanyEntity, companies) as unknown as CompanyRepository,
        repo(CompanyContactEntity, contacts) as unknown as CompanyContactRepository,
        offerRepo as unknown as OfferRepository,
        runRepo as unknown as ResearchRunRepository,
        handoff,
    );
    const dialog = new TelegramDialog(service, {} as never, {} as never, {
        deliver(message) {
            sent.push(message);

            return Promise.resolve();
        },
    }, handoff, launch);

    const category = stamp(new CategoryEntity(), {
        code: 'clothing',
        name: 'Одежда',
        description: 'Одежда',
        status: CategoryStatus.ACTIVE,
    });
    const question = stamp(new CategoryQuestionEntity(), {
        category,
        questionPack: null,
        code: 'quantity',
        prompt: 'Сколько штук?',
        answerType: QuestionAnswerType.NUMBER,
        choices: null,
        isRequired: true,
        sortOrder: 0,
    });

    em.persist(category);
    em.persist(stamp(new CategoryPhraseEntity(), { category, phrase: TEXT }));
    em.persist(question);

    if (options?.liveCard) {
        const product = stamp(new CanonicalProductEntity(), {
            category,
            nameRu: 'Халат',
            nameZh: null,
            attributes: {},
        });
        const company = stamp(new CompanyEntity(), { legalNameZh: '义乌工厂', name: 'Иуская фабрика' });
        const offer = stamp(new OfferEntity(), {
            sourceUrl: 'https://shop.example/coat',
            title: 'Халат',
            price: '38.5',
            currency: 'CNY',
            layer: MarketPriceLayer.FACTORY,
            site: '1688',
            capturedAt: new Date(),
        });
        const card = stamp(new OptimalCardEntity(), {
            category,
            canonicalProduct: product,
            qtyMin: '1',
            qtyMax: '5000',
            quantityQuestion: question,
            isLive: true,
            offer,
            company,
            price: '38.5',
            currency: 'CNY',
            contactUrl: offer.sourceUrl,
            productAttributes: {},
            expiresAt: new Date('2027-06-01T00:00:00.000Z'),
            markedLiveAt: new Date('2026-11-01T00:00:00.000Z'),
        });

        em.persist(product);
        em.persist(company);
        em.persist(offer);
        em.persist(card);
    }

    return { dialog, service, launch, runner, handoff, sent, inquiries, runs, offers, cards, usages, category, question };
}

function clientText(text: string): TelegramIncoming {
    return { kind: 'message', chatId: CLIENT, telegramUserId: CLIENT, text, photoFileIds: [] };
}

function press(telegramUserId: number, data: string): TelegramIncoming {
    return { kind: 'callback', chatId: telegramUserId, telegramUserId, callbackQueryId: `cb-${data}`, data };
}

function texts(sent: TelegramOutgoing[], chatId: number): string[] {
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

function dossier(inquiryId: string, runId: string, status: 'partial' | 'failed' | 'complete' = 'partial') {
    return {
        inquiry_id: inquiryId,
        run_id: runId,
        status,
        category: 'clothing',
        sites: [
            { site: '1688', status: 'captcha' },
            { site: 'wildberries', status: 'blocked' },
        ],
        companies: [
            {
                name_cn: '义乌市实验服有限公司',
                name: 'Yiwu Labwear',
                uscc: '91330782MA2ABCDE1X',
                role: 'DIRECT_FACTORY',
            },
        ],
        offers:
            status === 'failed'
                ? []
                : [
                      {
                          company_ref: 0,
                          site: '1688',
                          source_url: DEAR_URL,
                          quote: 'дороже',
                          title: 'дорогой халат',
                          price: 40,
                          currency: 'CNY',
                          unit: 'piece',
                          layer: 'FACTORY',
                      },
                      {
                          company_ref: 0,
                          site: '1688',
                          source_url: CHEAP_URL,
                          quote: 'дешевле',
                          title: 'дешёвый халат',
                          price: 12.5,
                          currency: 'CNY',
                          unit: 'piece',
                          qty_from: 100,
                          layer: 'FACTORY',
                      },
                      {
                          site: 'wildberries',
                          source_url: 'https://www.wildberries.ru/catalog/1/detail.aspx',
                          quote: 'розница',
                          title: 'витрина',
                          price: 990,
                          currency: 'RUB',
                          unit: 'piece',
                          layer: 'RUSSIA_RETAIL',
                      },
                  ],
        summary_ru: status === 'failed' ? 'Площадки не открылись' : 'Сводка для менеджера: завод дешевле витрины.',
    };
}

async function ask(harness: ReturnType<typeof build>) {
    await harness.dialog.handle(clientText(TEXT));
    await harness.dialog.handle(clientText('1000'));

    const inquiry = harness.inquiries[0];

    if (!inquiry) {
        throw new Error('заявка не создана');
    }

    return inquiry;
}

function restoreEnv(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];

        return;
    }

    process.env[name] = value;
}

describe('передача менеджеру', () => {
    const previousAdmins = process.env.ADMIN_TELEGRAM_IDS;
    const previousUrl = process.env.RESEARCH_TRIGGER_URL;
    const originalFetch = global.fetch;

    beforeEach(() => {
        process.env.ADMIN_TELEGRAM_IDS = ADMINS.join(',');
        process.env.LOGGER_SILENT = 'true';
        process.env.RESEARCH_TRIGGER_RETRY_DELAY_MS = '0';
        process.env.RESEARCH_TRIGGER_MAX_ATTEMPTS = '3';
        delete process.env.RESEARCH_TRIGGER_URL;
        global.fetch = jest.fn(async () => new Response('no', { status: 503 })) as typeof fetch;
    });

    afterEach(() => {
        restoreEnv('ADMIN_TELEGRAM_IDS', previousAdmins);
        restoreEnv('RESEARCH_TRIGGER_URL', previousUrl);
        global.fetch = originalFetch;
    });

    it('карточку из базы видят все админы, клиент получает текст без цены', async () => {
        const harness = build({ liveCard: true });
        const inquiry = await ask(harness);
        const client = texts(harness.sent, CLIENT).join('\n');

        expect(inquiry.status).toBe(InquiryStatus.SERVED_FROM_DATABASE);
        expect(harness.usages).toHaveLength(0);
        expect(texts(harness.sent, CLIENT).at(-1)).toBe('Менеджер скоро ответит');
        expect(client).not.toMatch(CLIENT_PRICE);
        expect(client).not.toContain('38.5');

        for (const admin of ADMINS) {
            const message = texts(harness.sent, admin).join('\n');

            expect(message).toContain('Нашлась оптимальная карточка');
            expect(message).toContain(TEXT);
            expect(message).toContain('Одежда');
            expect(message).toContain('Иуская фабрика');
            expect(message).toContain('38.5');
            expect(message).toContain('CNY');
            expect(message).toContain('https://shop.example/coat');
            expect(message).toMatch(CLIENT_PRICE);
        }
    });

    it('досье уходит каждому админу со сводкой, слоями и заводской ценой', async () => {
        const harness = build();
        const inquiry = await ask(harness);
        const run = harness.runs[0];

        await harness.runner.ingest(dossier(inquiry.id, run.runId ?? '', 'partial'));

        const client = texts(harness.sent, CLIENT).join('\n');

        expect(inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(texts(harness.sent, CLIENT).at(-1)).toBe('Заявка принята, менеджер скоро ответит');
        expect(client).not.toMatch(CLIENT_PRICE);
        expect(client).not.toContain('12.5');
        expect(client).not.toContain('Сводка для менеджера');

        for (const admin of ADMINS) {
            const message = texts(harness.sent, admin).join('\n');
            const actions = buttons(harness.sent, admin).map((button) => button.text);

            expect(message).toContain('Досье готово, частично');
            expect(message).toContain('Частичное: да');
            expect(message).toContain('Сводка для менеджера: завод дешевле витрины.');
            expect(message).toContain('Компаний: 1');
            expect(message).toContain('FACTORY 2');
            expect(message).toContain('RUSSIA_RETAIL 1');
            expect(message).toContain('captcha');
            expect(message).toContain('blocked');
            expect(message).toContain(CHEAP_URL);
            expect(message.indexOf('12.5')).toBeLessThan(message.indexOf('40 CNY'));
            expect(message).toMatch(CLIENT_PRICE);
            expect(actions).toEqual(expect.arrayContaining(['Сделать оптимальной', 'Закрыть', 'Перезапустить']));
        }
    });

    it('незапустившийся прогон и зависший прогон пишутся всем админам', async () => {
        process.env.RESEARCH_TRIGGER_URL = 'https://research.example/hook';
        const harness = build();
        const inquiry = await ask(harness);

        expect(harness.runs[0]?.status).toBe(ResearchRunStatus.FAILED_TO_START);
        expect(harness.usages[0]?.researchCount).toBe(1);
        expect(texts(harness.sent, CLIENT).join('\n')).not.toMatch(CLIENT_PRICE);

        for (const admin of ADMINS) {
            const message = texts(harness.sent, admin).join('\n');

            expect(message).toContain('Ресерч не запустился');
            expect(message).toContain('HTTP 503');
            expect(message).toContain(TEXT);
        }

        harness.runs[0].status = ResearchRunStatus.RUNNING;
        harness.runs[0].startedAt = new Date('2026-06-01T09:00:00.000Z');
        const marked = await harness.launch.markStale(new Date('2026-06-01T12:00:00.000Z'));

        expect(marked).toHaveLength(1);

        for (const admin of ADMINS) {
            expect(texts(harness.sent, admin).join('\n')).toContain('Ресерч завис');
        }
    });

    it('досье failed тоже уходит админам и не содержит цену у клиента', async () => {
        const harness = build();
        const inquiry = await ask(harness);

        await harness.runner.ingest(dossier(inquiry.id, harness.runs[0].runId ?? '', 'failed'));

        expect(inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(texts(harness.sent, CLIENT).join('\n')).not.toMatch(CLIENT_PRICE);

        for (const admin of ADMINS) {
            const message = texts(harness.sent, admin).join('\n');

            expect(message).toContain('Досье failed');
            expect(message).toContain('Площадки не открылись');
        }
    });

    it('кнопка от клиента не закрывает заявку и не создаёт карточку', async () => {
        const harness = build();
        const inquiry = await ask(harness);

        await harness.dialog.handle(press(CLIENT, `cl:${inquiry.id}`));
        await harness.dialog.handle(press(CLIENT, `mo:${inquiry.id}`));
        await harness.dialog.handle(press(CLIENT, `rr:${inquiry.id}`));

        expect(texts(harness.sent, CLIENT).join('\n')).toContain('Это действие для админа.');
        expect(inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(harness.cards).toHaveLength(0);
        expect(harness.runs).toHaveLength(1);
        expect(harness.usages[0]?.researchCount).toBe(1);
    });

    it('Сделать оптимальной создаёт живую карточку по дешёвому заводскому офферу', async () => {
        const harness = build();
        const inquiry = await ask(harness);

        await harness.runner.ingest(dossier(inquiry.id, harness.runs[0].runId ?? ''));
        await harness.dialog.handle(press(ADMINS[0], `mo:${inquiry.id}`));

        const live = harness.cards.filter((card) => card.isLive);
        const cheap = harness.offers.find((offer) => offer.sourceUrl === CHEAP_URL);

        expect(texts(harness.sent, ADMINS[0]).at(-1)).toContain('Оптимальная карточка сохранена');
        expect(live).toHaveLength(1);
        expect(live[0]?.offer?.id).toBe(cheap?.id);
        expect(Number(live[0]?.price)).toBe(12.5);
        expect(live[0]?.currency).toBe('CNY');
        expect(live[0]?.category.id).toBe(harness.category.id);
        expect(Number(live[0]?.qtyMin)).toBe(1000);
    });

    it('Закрыть переводит заявку в CLOSED', async () => {
        const harness = build();
        const inquiry = await ask(harness);

        await harness.dialog.handle(press(ADMINS[0], `cl:${inquiry.id}`));

        expect(inquiry.status).toBe(InquiryStatus.CLOSED);
        expect(inquiry.closedAt).toBeInstanceOf(Date);
        expect(texts(harness.sent, ADMINS[0]).at(-1)).toBe('Заявка закрыта.');
    });

    it('Перезапустить создаёт новый run и не списывает лимит', async () => {
        const harness = build();
        const inquiry = await ask(harness);
        const first = harness.runs[0]?.runId;

        await harness.dialog.handle(press(ADMINS[0], `rr:${inquiry.id}`));

        expect(harness.runs).toHaveLength(2);
        expect(harness.runs[1]?.runId).not.toBe(first);
        expect(inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(harness.usages[0]?.researchCount).toBe(1);
        expect(texts(harness.sent, ADMINS[0]).at(-1)).toBe('Ресерч запущен заново.');
        expect(texts(harness.sent, CLIENT).join('\n')).not.toMatch(CLIENT_PRICE);
    });

    it('сбой Telegram не ломает приём досье и записывает ошибку', async () => {
        const harness = build({
            notify: {
                async send() {
                    throw new Error('telegram down');
                },
            },
        });
        const inquiry = await ask(harness);
        const result = await harness.runner.ingest(dossier(inquiry.id, harness.runs[0].runId ?? '', 'complete'));

        expect(result.inquiryStatus).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(harness.runs[0]?.notifyLastError).toContain('telegram down');
    });
});
