import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { RESEARCH_TRIGGER_HEADER } from '../../../ports/research-trigger.port';
import { CompanyContactEntity } from '../../../../domain/entities/catalog/company-contact.entity';
import { CompanyEntity } from '../../../../domain/entities/catalog/company.entity';
import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../../../domain/entities/category/category-site.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { InquiryAnswerEntity } from '../../../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { DailyUsageEntity } from '../../../../domain/entities/tariff/daily-usage.entity';
import { PlanEntity } from '../../../../domain/entities/tariff/plan.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { SiteRole } from '../../../../domain/enums/site-role.enum';
import { CompanyContactRepository } from '../../../../domain/repositories/catalog/company-contact.repository';
import { CompanyRepository } from '../../../../domain/repositories/catalog/company.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
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
import { ApiExceptionFilter } from '../../../../interfaces/http/filters/api-exception.filter';
import { AdminTokenGuard } from '../../../../interfaces/http/auth/admin-token.guard';
import { ResearchRerunController } from '../../../../interfaces/http/controllers/inquiry/research-rerun.controller';
import { ApiResponseInterceptor } from '../../../../interfaces/http/interceptors/api-response.interceptor';
import { InquiryServiceImpl } from '../inquiry/inquiry.service.impl';
import { LimitCheckerServiceImpl } from '../tariff/limit-checker.service.impl';
import { JsonResearchRunner } from './json-research-runner';
import { GrokWebhookTrigger } from '../../../../infrastructure/research/grok-webhook.trigger';
import { RESEARCH_LAUNCH_SERVICE, ResearchLaunchService } from './research-launch.service';

const CLIENT = 9000004242;
const TEXT = 'лабораторные халаты';
const TRIGGER_URL = 'https://research.example/hook';
const TRIGGER_SECRET = 'trigger-secret';
const ADMIN_TOKEN = 'admin-static-token';

type Stored = { id: string };
type FetchCall = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

const state: { launch: ResearchLaunchService | null } = { launch: null };

@Module({
    controllers: [ResearchRerunController],
    providers: [
        { provide: APP_GUARD, useClass: AdminTokenGuard },
        {
            provide: RESEARCH_LAUNCH_SERVICE,
            useFactory: () => {
                if (!state.launch) {
                    throw new Error('launch is not ready');
                }

                return state.launch;
            },
        },
    ],
})
class RerunTestModule {}

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
    const sites: CategorySiteEntity[] = [];
    const inquiries: InquiryEntity[] = [];
    const answers: InquiryAnswerEntity[] = [];
    const cards: OptimalCardEntity[] = [];
    const runs: ResearchRunEntity[] = [];
    const companies: CompanyEntity[] = [];
    const contacts: CompanyContactEntity[] = [];
    const offers: OfferEntity[] = [];
    const usages: DailyUsageEntity[] = [];
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
    const runRepo = repo(ResearchRunEntity, runs);
    const launch = new ResearchLaunchService(
        inquiryRepo as unknown as InquiryRepository,
        answerRepo as unknown as InquiryAnswerRepository,
        repo(CategorySiteEntity, sites) as unknown as CategorySiteRepository,
        runRepo as unknown as ResearchRunRepository,
        new GrokWebhookTrigger(),
    );
    const service = new InquiryServiceImpl(
        inquiryRepo as unknown as InquiryRepository,
        userRepo as unknown as AppUserRepository,
        repo(CategoryEntity, categories) as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        repo(QuestionPackEntity, packs) as unknown as QuestionPackRepository,
        repo(CategoryQuestionEntity, questions) as unknown as CategoryQuestionRepository,
        answerRepo as unknown as InquiryAnswerRepository,
        repo(OptimalCardEntity, cards) as unknown as OptimalCardRepository,
        limitChecker,
        undefined,
        launch,
    );
    const runner = new JsonResearchRunner(
        inquiryRepo as unknown as InquiryRepository,
        repo(CompanyEntity, companies) as unknown as CompanyRepository,
        repo(CompanyContactEntity, contacts) as unknown as CompanyContactRepository,
        repo(OfferEntity, offers) as unknown as OfferRepository,
        runRepo as unknown as ResearchRunRepository,
    );

    const category = stamp(new CategoryEntity(), {
        code: 'clothing',
        name: 'Одежда',
        description: 'Одежда и халаты',
        status: CategoryStatus.ACTIVE,
    });
    const phrase = stamp(new CategoryPhraseEntity(), { category, phrase: TEXT });
    const question = stamp(new CategoryQuestionEntity(), {
        category,
        questionPack: null,
        code: 'quantity',
        prompt: 'Сколько штук?',
        answerType: QuestionAnswerType.TEXT,
        choices: null,
        isRequired: true,
        sortOrder: 0,
    });
    const site = stamp(new CategorySiteEntity(), {
        category,
        siteRole: SiteRole.FACTORY_CONTACT,
        name: '1688',
        baseUrl: 'https://www.1688.com',
        priority: 1,
        requiresLogin: true,
        queryTemplate: '{товар} 源头工厂',
        excludeNote: null,
        isActive: true,
    });

    em.persist(category);
    em.persist(phrase);
    em.persist(question);
    em.persist(site);

    return {
        service,
        launch,
        inquiries,
        runs,
        usages,
        runner,
        category,
        questions,
        addQuestion(data: object) {
            const question = stamp(new CategoryQuestionEntity(), data);

            em.persist(question);

            return question;
        },
        addPack(data: object) {
            const pack = stamp(new QuestionPackEntity(), data);

            em.persist(pack);

            return pack;
        },
    };
}

function moscowToday(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
}

async function askUntilResearch(harness: ReturnType<typeof buildHarness>, text = '1000') {
    const created = await harness.service.create({ telegramUserId: CLIENT, text: TEXT });

    expect(created.inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
    expect(harness.runs).toHaveLength(0);

    await harness.service.answerQuestion({
        inquiryId: created.inquiry.id,
        telegramUserId: CLIENT,
        text,
    });

    return created.inquiry;
}

describe('запуск ресерча', () => {
    const originalFetch = global.fetch;
    let calls: FetchCall[];
    let fetchResult: (call: number) => { status: number } | Error;

    beforeEach(() => {
        process.env.RESEARCH_TRIGGER_URL = TRIGGER_URL;
        process.env.RESEARCH_TRIGGER_SECRET = TRIGGER_SECRET;
        process.env.PUBLIC_BASE_URL = 'http://finder.test';
        process.env.RESEARCH_TRIGGER_MAX_ATTEMPTS = '3';
        process.env.RESEARCH_TRIGGER_RETRY_DELAY_MS = '0';
        process.env.LOGGER_SILENT = 'true';
        calls = [];
        fetchResult = () => ({ status: 200 });
        global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const headers = (init?.headers ?? {}) as Record<string, string>;
            const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;

            calls.push({ url: String(input), headers, body });

            const result = fetchResult(calls.length);

            if (result instanceof Error) {
                throw result;
            }

            return new Response('accepted', { status: result.status });
        }) as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('последний базовый ответ одежды без пакета создаёт research_run и зовёт webhook', async () => {
        const harness = buildHarness();
        const pack = harness.addPack({
            category: harness.category,
            code: 'workwear',
            title: 'Спецодежда и лабораторные халаты',
            description: 'Дополнительные вопросы',
            sortOrder: 0,
            isActive: true,
        });
        const prompts = [
            'Что именно за изделие?',
            'Материал',
            'Размерный ряд',
            'Цвет',
            'Нужен ли свой крой или логотип?',
            'Какая цена в России уже попадалась?',
            'Город доставки',
        ];

        harness.questions[0].sortOrder = 2;
        prompts.forEach((prompt, index) => {
            harness.addQuestion({
                category: harness.category,
                questionPack: null,
                code: index === prompts.length - 1 ? 'delivery_city' : `q${index}`,
                prompt,
                answerType: QuestionAnswerType.TEXT,
                choices: null,
                isRequired: index === prompts.length - 1,
                sortOrder: index < 1 ? index + 1 : index + 3,
            });
        });
        harness.addQuestion({
            category: harness.category,
            questionPack: pack,
            code: 'disposable',
            prompt: 'Многоразовый или одноразовый?',
            answerType: QuestionAnswerType.SINGLE_CHOICE,
            choices: ['Многоразовый', 'Одноразовый'],
            isRequired: true,
            sortOrder: 1,
        });

        const created = await harness.service.create({ telegramUserId: CLIENT, text: TEXT });
        const replies = ['халат', 'хлопок', '1000', 'M', 'белый', 'нет', '500', 'Москва'];
        let last = created.inquiry;

        for (const reply of replies) {
            const step = await harness.service.answerQuestion({
                inquiryId: created.inquiry.id,
                telegramUserId: CLIENT,
                text: reply,
            });

            expect(step.kind === 'complete' || step.kind === 'asking').toBe(true);
            last = step.kind === 'idle' || step.kind === 'paused' ? last : step.view.inquiry;
        }

        const run = harness.runs[0];

        expect(last.status).toBe(InquiryStatus.RESEARCHING);
        expect(created.inquiry.questionPack ?? null).toBeNull();
        expect(harness.runs).toHaveLength(1);
        expect(run.status).toBe(ResearchRunStatus.RUNNING);
        expect(calls).toHaveLength(1);
        expect(calls[0].body.pack_code ?? null).toBeNull();
        expect(calls[0].body.answers).toHaveLength(8);
        expect(JSON.stringify(calls[0].body.answers)).toContain('Город доставки');
        expect(JSON.stringify(calls[0].body.answers)).not.toContain('Многоразовый или одноразовый');
        expect(JSON.stringify(calls[0].body)).not.toContain(String(CLIENT));
        expect(harness.usages[0].researchCount).toBe(1);
    });

    it('после ответа шлёт webhook с секретом и досье переводит заявку к админу', async () => {
        const harness = buildHarness();
        const inquiry = await askUntilResearch(harness);
        const run = harness.runs[0];

        expect(inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(run.status).toBe(ResearchRunStatus.RUNNING);
        expect(run.triggerAttempts).toBe(1);
        expect(harness.usages[0].researchCount).toBe(1);
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(TRIGGER_URL);
        expect(calls[0].headers[RESEARCH_TRIGGER_HEADER]).toBe(TRIGGER_SECRET);
        expect(calls[0].headers.authorization).toBe(`Bearer ${TRIGGER_SECRET}`);
        expect(calls[0].body).toMatchObject({
            type: 'finder.research.requested',
            inquiry_id: inquiry.id,
            run_id: run.runId,
            category_code: 'clothing',
            raw_text: TEXT,
            answers: [{ code: 'quantity', prompt: 'Сколько штук?', value: '1000' }],
            ingest_url: 'http://finder.test/research/ingest',
        });
        expect(calls[0].body.sites).toEqual([
            {
                name: '1688',
                role: SiteRole.FACTORY_CONTACT,
                priority: 1,
                requires_login: true,
                query_template: '{товар} 源头工厂',
            },
        ]);
        expect(JSON.stringify(calls[0].body)).not.toContain(String(CLIENT));
        expect(JSON.stringify(calls[0].body)).not.toContain('price');

        const ingested = await harness.runner.ingest({
            inquiry_id: inquiry.id,
            run_id: run.runId,
            status: 'complete',
            category: 'clothing',
            sites: [],
            companies: [],
            offers: [],
            summary_ru: 'досье принято',
        });

        expect(ingested.inquiryStatus).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(ingested.duplicate).toBe(false);
    });

    it('повторяет 5xx, записывает попытки и списывает лимит один раз', async () => {
        fetchResult = () => ({ status: 503 });
        const harness = buildHarness();
        const inquiry = await askUntilResearch(harness);
        const run = harness.runs[0];

        expect(calls).toHaveLength(3);
        expect(new Set(calls.map((call) => call.body.run_id)).size).toBe(1);
        expect(run.status).toBe(ResearchRunStatus.FAILED_TO_START);
        expect(run.triggerAttempts).toBe(3);
        expect(run.triggerLastError).toBe('HTTP 503');
        expect(run.failureReason).toBe('HTTP 503');
        expect(inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(harness.usages[0].researchCount).toBe(1);
    });

    it('без URL не падает и оставляет заявку в RESEARCHING', async () => {
        delete process.env.RESEARCH_TRIGGER_URL;
        const harness = buildHarness();
        const inquiry = await askUntilResearch(harness);
        const run = harness.runs[0];

        expect(calls).toHaveLength(0);
        expect(inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(run.status).toBe(ResearchRunStatus.PENDING);
        expect(run.triggerLastError).toContain('RESEARCH_TRIGGER_URL не задан');
        expect(harness.usages[0].researchCount).toBe(1);
    });

    it('помечает прогон без досье старше порога и не трогает свежий и уже упавший', async () => {
        const harness = buildHarness();
        const first = await askUntilResearch(harness);
        const secondView = await harness.service.create({ telegramUserId: CLIENT + 1, text: TEXT });

        await harness.service.answerQuestion({
            inquiryId: secondView.inquiry.id,
            telegramUserId: CLIENT + 1,
            text: '200',
        });

        const clock = new Date('2026-06-01T12:00:00.000Z');
        const [stale, fresh] = harness.runs;

        stale.startedAt = new Date(clock.getTime() - 61 * 60_000);
        fresh.startedAt = new Date(clock.getTime() - 10 * 60_000);
        fetchResult = () => ({ status: 500 });

        const failed = await harness.launch.startForInquiry(first);

        expect(failed.status).toBe(ResearchRunStatus.FAILED_TO_START);

        const marked = await harness.launch.markStale(clock);

        expect(marked.map((run) => run.id)).toEqual([stale.id]);
        expect(stale.status).toBe(ResearchRunStatus.STALE);
        expect(stale.failureReason).toContain('Нет досье');
        expect(stale.finishedAt).toEqual(clock);
        expect(fresh.status).toBe(ResearchRunStatus.RUNNING);
        expect(failed.status).toBe(ResearchRunStatus.FAILED_TO_START);
        expect(first.status).toBe(InquiryStatus.RESEARCHING);
    });

    it('повтор админом создаёт новый run_id и не списывает лимит', async () => {
        const harness = buildHarness();
        const inquiry = await askUntilResearch(harness);
        const firstRunId = harness.runs[0].runId;

        await harness.runner.ingest({
            inquiry_id: inquiry.id,
            run_id: firstRunId,
            status: 'complete',
            category: 'clothing',
            sites: [],
            companies: [],
            offers: [],
        });
        expect(inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);

        process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
        state.launch = harness.launch;
        const app = await NestFactory.create<NestFastifyApplication>(RerunTestModule, new FastifyAdapter(), {
            logger: false,
        });

        app.useGlobalInterceptors(new ApiResponseInterceptor());
        app.useGlobalFilters(new ApiExceptionFilter(app.get(HttpAdapterHost)));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const denied = await app.getHttpAdapter().getInstance().inject({
            method: 'POST',
            url: `/admin/inquiries/${inquiry.id}/rerun-research`,
        });
        const allowed = await app.getHttpAdapter().getInstance().inject({
            method: 'POST',
            url: `/admin/inquiries/${inquiry.id}/rerun-research`,
            headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        });

        await app.close();

        const body = allowed.json() as { data: { runId: string; inquiryStatus: string; runStatus: string } };

        expect(denied.statusCode).toBe(401);
        expect(allowed.statusCode).toBe(200);
        expect(body.data.runId).not.toBe(firstRunId);
        expect(body.data.inquiryStatus).toBe(InquiryStatus.RESEARCHING);
        expect(body.data.runStatus).toBe(ResearchRunStatus.RUNNING);
        expect(Object.keys(body.data).sort()).toEqual(['inquiryId', 'inquiryStatus', 'runId', 'runStatus']);
        expect(harness.runs.map((run) => run.runId)).toEqual([firstRunId, body.data.runId]);
        expect(calls[1].body.run_id).toBe(body.data.runId);
        expect(calls[1].headers[RESEARCH_TRIGGER_HEADER]).toBe(TRIGGER_SECRET);
        expect(calls[1].headers.authorization).toBe(`Bearer ${TRIGGER_SECRET}`);
        expect(harness.usages[0].researchCount).toBe(1);
        expect(JSON.stringify(body)).not.toContain('price');
    });

    it('исчерпанный лимит не вызывает webhook и не увеличивает счётчик', async () => {
        const harness = buildHarness();
        const created = await harness.service.create({ telegramUserId: CLIENT, text: TEXT });
        const user = harness.usages.length;

        harness.usages.push(
            stamp(new DailyUsageEntity(), {
                user: created.inquiry.clientUser,
                usageDate: moscowToday(),
                researchCount: 3,
            }),
        );
        expect(user).toBe(0);

        await harness.service.answerQuestion({
            inquiryId: created.inquiry.id,
            telegramUserId: CLIENT,
            text: '1000',
        });

        expect(created.inquiry.status).toBe(InquiryStatus.LIMIT_EXCEEDED);
        expect(harness.runs).toHaveLength(0);
        expect(calls).toHaveLength(0);
        expect(harness.usages[0].researchCount).toBe(3);
    });
});
