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
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
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
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { GrokWebhookTrigger } from '../../../../infrastructure/research/grok-webhook.trigger';
import { InquiryServiceImpl } from '../inquiry/inquiry.service.impl';
import { OptimalCardServiceImpl } from '../market/optimal-card.service.impl';
import { JsonResearchRunner } from '../research/json-research-runner';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { ResearchLaunchService } from '../research/research-launch.service';
import { Logger } from '../../../../common/logger/logger';
import { ManagerHandoffService } from './manager-handoff.service';

const TEXT = 'халат';
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

function build(options?: { liveCard?: boolean }) {
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
    const userRepo = repo(AppUserEntity, users);
    const inquiryRepo = repo(InquiryEntity, inquiries);
    const answerRepo = repo(InquiryAnswerEntity, answers);
    const questionRepo = repo(CategoryQuestionEntity, questions);
    const categoryRepo = repo(CategoryEntity, categories);
    const offerRepo = repo(OfferEntity, offers);
    const runRepo = repo(ResearchRunEntity, runs);
    const cardRepo = repo(OptimalCardEntity, cards);
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

    return { service, launch, runner, handoff, inquiries, runs, offers, cards, category, question, users };
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
    const created = await harness.service.create({ text: TEXT });
    const inquiry = created.inquiry;

    if (inquiry.status !== InquiryStatus.RESEARCHING && inquiry.status !== InquiryStatus.SERVED_FROM_DATABASE) {
        await harness.launch.startForInquiry(inquiry);
    }

    return inquiry;
}

function adminOf(harness: ReturnType<typeof build>) {
    const existing = harness.users.find((user) => user.role === UserRole.ADMIN);

    if (existing) {
        return existing;
    }

    const admin = Object.assign(new AppUserEntity(), {
        role: UserRole.ADMIN,
        displayName: 'Admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: null,
    });

    harness.users.push(admin);

    return admin;
}

function restoreEnv(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];

        return;
    }

    process.env[name] = value;
}

describe('передача менеджеру', () => {
    const previousUrl = process.env.RESEARCH_TRIGGER_URL;
    const originalFetch = global.fetch;

    beforeEach(() => {
        process.env.LOGGER_SILENT = 'true';
        process.env.RESEARCH_TRIGGER_RETRY_DELAY_MS = '0';
        process.env.RESEARCH_TRIGGER_MAX_ATTEMPTS = '3';
        delete process.env.RESEARCH_TRIGGER_URL;
        global.fetch = jest.fn(async () => new Response('no', { status: 503 })) as typeof fetch;
    });

    afterEach(() => {
        restoreEnv('RESEARCH_TRIGGER_URL', previousUrl);
        global.fetch = originalFetch;
    });

    it('карточка из базы пишется в лог без отдельного клиентского канала', async () => {
        const harness = build({ liveCard: true });
        const inquiry = harness.inquiries[0] ?? (await harness.service.create({ text: TEXT })).inquiry;

        inquiry.optimalCard = harness.cards[0];
        inquiry.status = InquiryStatus.SERVED_FROM_DATABASE;
        const info = jest.spyOn(Logger, 'info').mockImplementation(() => undefined);

        await harness.handoff.onCardServed(inquiry);

        const logged = info.mock.calls.map((call) => String(call[0])).join('\n');

        expect(logged).toContain('Нашлась оптимальная карточка');
        expect(logged).toContain(TEXT);
        expect(logged).toContain('Иуская фабрика');
        expect(logged).toContain('38.5');
        info.mockRestore();
    });

    it('досье пишет сводку в лог и переводит заявку к админу', async () => {
        const harness = build();
        const inquiry = await ask(harness);
        const info = jest.spyOn(Logger, 'info').mockImplementation(() => undefined);

        await harness.runner.ingest(dossier(inquiry.id, harness.runs[0].runId ?? '', 'partial'));

        const logged = info.mock.calls.map((call) => String(call[0])).join('\n');

        expect(inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(logged).toContain('Досье готово, частично');
        expect(logged).toContain(CHEAP_URL);
        expect(logged).toContain('FACTORY');
        info.mockRestore();
    });

    it('незапустившийся и зависший прогон пишутся в лог', async () => {
        process.env.RESEARCH_TRIGGER_URL = 'https://research.example/hook';
        const harness = build();
        const info = jest.spyOn(Logger, 'info').mockImplementation(() => undefined);
        const inquiry = await ask(harness);

        expect(harness.runs[0]?.status).toBe(ResearchRunStatus.FAILED_TO_START);
        expect(info.mock.calls.map((call) => String(call[0])).join('\n')).toContain('Ресерч не запустился');

        harness.runs[0].status = ResearchRunStatus.RUNNING;
        harness.runs[0].startedAt = new Date('2026-06-01T09:00:00.000Z');
        const marked = await harness.launch.markStale(new Date('2026-06-01T12:00:00.000Z'));

        expect(marked).toHaveLength(1);
        expect(info.mock.calls.map((call) => String(call[0])).join('\n')).toContain('Ресерч завис');
        expect(inquiry.status).toBe(InquiryStatus.RESEARCHING);
        info.mockRestore();
    });

    it('досье failed пишется в лог и не откатывает приём', async () => {
        const harness = build();
        const inquiry = await ask(harness);
        const info = jest.spyOn(Logger, 'info').mockImplementation(() => undefined);

        await harness.runner.ingest(dossier(inquiry.id, harness.runs[0].runId ?? '', 'failed'));

        expect(inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(info.mock.calls.map((call) => String(call[0])).join('\n')).toContain('Досье failed');
        expect(harness.runs[0]?.notifyLastError ?? null).toBeNull();
        info.mockRestore();
    });

    it('сделать оптимальной создаёт живую карточку по дешёвому заводскому офферу', async () => {
        const harness = build();
        const inquiry = await ask(harness);
        const admin = adminOf(harness);

        await harness.runner.ingest(dossier(inquiry.id, harness.runs[0].runId ?? ''));
        const card = await harness.handoff.makeOptimal(inquiry.id, admin.id);
        const cheap = harness.offers.find((offer) => offer.sourceUrl === CHEAP_URL);

        expect(card.isLive).toBe(true);
        expect(card.offer?.id).toBe(cheap?.id);
        expect(Number(card.price)).toBe(12.5);
        expect(card.currency).toBe('CNY');
        expect(card.category.id).toBe(harness.category.id);
    });

    it('закрыть переводит заявку в CLOSED', async () => {
        const harness = build();
        const inquiry = await ask(harness);
        const admin = adminOf(harness);
        const closed = await harness.handoff.close(inquiry.id, admin.id);

        expect(closed.status).toBe(InquiryStatus.CLOSED);
        expect(closed.closedAt).toBeInstanceOf(Date);
    });

    it('повторный запуск создаёт новый run', async () => {
        const harness = build();
        const inquiry = await ask(harness);
        const first = harness.runs[0]?.runId;
        const again = await harness.launch.rerun(inquiry.id);

        expect(harness.runs).toHaveLength(2);
        expect(again.runId).not.toBe(first);
        expect(inquiry.status).toBe(InquiryStatus.RESEARCHING);
    });
});
