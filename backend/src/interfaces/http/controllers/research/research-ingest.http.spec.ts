import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { RESEARCH_RUNNER } from '../../../../application/ports/research-runner.port';
import { JsonResearchRunner } from '../../../../application/services/impls/research/json-research-runner';
import { CompanyContactEntity } from '../../../../domain/entities/catalog/company-contact.entity';
import { CompanyEntity } from '../../../../domain/entities/catalog/company.entity';
import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { CompanyContactRepository } from '../../../../domain/repositories/catalog/company-contact.repository';
import { CompanyRepository } from '../../../../domain/repositories/catalog/company.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { ApiExceptionFilter } from '../../filters/api-exception.filter';
import { ApiResponseInterceptor } from '../../interceptors/api-response.interceptor';
import { AdminTokenGuard } from '../../auth/admin-token.guard';
import { ResearchIngestHttpService } from '../../services/impls/research/research-ingest.http-service';
import { ResearchIngestController } from './research-ingest.controller';

const TOKEN = 'ingest-secret';
const USCC = '91330782MA2ABCDE1X';
const PRICE = '38.5';

type Stored = { id: string };

const state: { runner: JsonResearchRunner | null } = { runner: null };

@Module({
    controllers: [ResearchIngestController],
    providers: [
        {
            provide: RESEARCH_RUNNER,
            useFactory: () => {
                if (!state.runner) {
                    throw new Error('runner is not ready');
                }

                return state.runner;
            },
        },
        ResearchIngestHttpService,
        { provide: APP_GUARD, useClass: AdminTokenGuard },
    ],
})
class ResearchIngestTestModule {}

function matches(entity: object, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, expected]) => {
        const actual = (entity as Record<string, unknown>)[key];

        if (actual && typeof actual === 'object' && 'id' in actual) {
            const expectedId =
                typeof expected === 'string' ? expected : (expected as { id?: string } | null)?.id;

            return (actual as { id: string }).id === expectedId;
        }

        return actual === expected;
    });
}

function stamp<T extends object>(entity: T, data: object): T {
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
    const inquiries: InquiryEntity[] = [];
    const companies: CompanyEntity[] = [];
    const contacts: CompanyContactEntity[] = [];
    const offers: OfferEntity[] = [];
    const runs: ResearchRunEntity[] = [];
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
        async flush() {
            return undefined;
        },
        async transactional<T>(work: (tx: typeof em) => Promise<T>): Promise<T> {
            return work(em);
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

    const category = stamp(new CategoryEntity(), {
        code: 'clothing',
        name: 'Одежда',
        description: 'без цены для клиента',
        status: CategoryStatus.ACTIVE,
    });
    const inquiry = stamp(new InquiryEntity(), {
        status: InquiryStatus.COLLECTING_ANSWERS,
        rawText: 'лабораторные халаты',
        photoUrls: [],
        category,
        isPaused: false,
    });
    const runner = new JsonResearchRunner(
        repo(InquiryEntity, inquiries) as unknown as InquiryRepository,
        repo(CompanyEntity, companies) as unknown as CompanyRepository,
        repo(CompanyContactEntity, contacts) as unknown as CompanyContactRepository,
        repo(OfferEntity, offers) as unknown as OfferRepository,
        repo(ResearchRunEntity, runs) as unknown as ResearchRunRepository,
    );

    em.persist(inquiry);

    return { runner, inquiry, companies, contacts, offers, runs };
}

function trial(inquiryId: string, runId: string) {
    return {
        inquiry_id: inquiryId,
        run_id: runId,
        status: 'complete',
        category: 'clothing',
        pack: 'workwear',
        started_at: '2026-11-14T08:00:00.000Z',
        finished_at: '2026-11-14T08:10:00.000Z',
        sites: [{ site: '1688', status: 'ok', url: 'https://s.1688.com/selloffer/offer_search.htm' }],
        companies: [
            {
                name_cn: '义乌市实验服有限公司',
                name: 'Yiwu Labwear',
                uscc: USCC,
                registry_status: 'active',
                scope: '服装',
                insured_count: 120,
                role: 'DIRECT_FACTORY',
                role_evidence: ['цех указан на витрине'],
                contacts: [
                    { channel: 'phone', value: '+86-579-0000', source_url: 'https://shop.1688.com/lab' },
                    { channel: 'wechat', value: 'labwear', source_url: '' },
                ],
            },
        ],
        offers: [
            {
                company_ref: 0,
                site: '1688',
                source_url: 'https://detail.1688.com/offer/1.html',
                quote: 'хлопок, от 500 штук',
                title: '实验室白大褂',
                price: 38.5,
                currency: 'CNY',
                unit: 'piece',
                qty_from: 500,
                moq: 100,
                layer: 'FACTORY',
                captured_at: '2026-11-14T08:05:00.000Z',
            },
            {
                source_url: 'https://detail.1688.com/offer/no-quote.html',
                price: 12,
                title: 'без цитаты',
            },
            { quote: 'нет ссылки', title: 'мусор' },
        ],
        fx: { cny_rub: 12.3149, usd_rub: 82.1516, as_of: '2026-11-14', source: 'cbr.ru' },
        summary_ru: 'Завод в Иу, витрина 1688 открылась.',
        extra_bot_field: 'dispatcher',
    };
}

function coats1688(inquiryId: string, runId: string) {
    return {
        inquiry_id: inquiryId,
        run_id: runId,
        status: 'complete',
        category: 'clothing',
        sites: [{ site: '1688', status: 'ok' }],
        companies: [
            {
                name_cn: '义乌市实验服有限公司',
                name: 'Yiwu Labwear',
                uscc: USCC,
                role: 'DIRECT_FACTORY',
                contacts: [{ channel: 'email', value: 'sales@lab.example', source_url: 'https://shop.1688.com/contact' }],
            },
        ],
        offers: [
            {
                company_ref: 0,
                site: '1688',
                source_url: 'https://detail.1688.com/offer/2.html',
                quote: 'партия от ста штук',
                title: '白大褂 1688',
                price: 36,
                currency: 'CNY',
                unit: 'piece',
                layer: 'CHINA_OPEN',
            },
        ],
        summary_ru: 'Вторая выдача 1688 по тому же заводу.',
    };
}

function browser(inquiryId: string, runId: string) {
    return {
        inquiry_id: inquiryId,
        run_id: runId,
        status: 'partial',
        category: 'clothing',
        sites: [{ site: 'wildberries', status: 'captcha', note: 'капча' }],
        companies: [
            {
                name: 'Розничный список',
                role: 'DEALER_OR_LIST_PRICE',
                contacts: [{ channel: 'site', value: 'https://shop.example/coat', source_url: 'https://shop.example/coat' }],
            },
        ],
        offers: [
            {
                company_ref: 0,
                site: 'wildberries',
                source_url: 'https://www.wildberries.ru/catalog/1/detail.aspx',
                quote: 'белый, размер 48',
                title: 'Халат лабораторный',
                price: 990,
                currency: 'RUB',
                unit: 'piece',
                layer: 'RUSSIA_RETAIL',
            },
        ],
        summary_ru: 'Площадка с капчей, одна розничная позиция.',
    };
}

async function boot(runner: JsonResearchRunner) {
    state.runner = runner;
    const app = await NestFactory.create<NestFastifyApplication>(ResearchIngestTestModule, new FastifyAdapter(), {
        logger: false,
    });

    app.useGlobalInterceptors(new ApiResponseInterceptor());
    app.useGlobalFilters(new ApiExceptionFilter(app.get(HttpAdapterHost)));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    return app;
}

function post(app: NestFastifyApplication, token: string | null, body: unknown) {
    return app.getHttpAdapter().getInstance().inject({
        method: 'POST',
        url: '/research/ingest',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        payload: body as object,
    });
}

describe('POST /research/ingest', () => {
    beforeAll(() => {
        process.env.RESEARCH_INGEST_TOKEN = TOKEN;
    });

    it('принимает три досье, пишет контакты и не плодит компанию с тем же USCC', async () => {
        const harness = buildHarness();
        const app = await boot(harness.runner);
        const firstRun = randomUUID();
        const secondRun = randomUUID();
        const thirdRun = randomUUID();

        const first = await post(app, TOKEN, trial(harness.inquiry.id, firstRun));
        const second = await post(app, TOKEN, coats1688(harness.inquiry.id, secondRun));
        const third = await post(app, TOKEN, browser(harness.inquiry.id, thirdRun));

        await app.close();

        const firstBody = JSON.parse(first.body);
        const thirdBody = JSON.parse(third.body);

        expect(first.statusCode).toBe(200);
        expect(second.statusCode).toBe(200);
        expect(third.statusCode).toBe(200);
        expect(firstBody.data.inquiry_status).toBe('DOSSIER_WITH_ADMIN');
        expect(firstBody.data.duplicate).toBe(false);
        expect(firstBody.data.counts).toEqual({ companies: 1, offers: 1, contacts: 1 });
        expect(firstBody.data.discarded).toEqual([
            { path: 'companies[0].contacts[1]', reason: 'нет source_url' },
            { path: 'offers[1]', reason: 'нет quote' },
            { path: 'offers[2]', reason: 'нет source_url' },
        ]);
        expect(thirdBody.data.counts.offers).toBe(1);
        expect(harness.inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(harness.companies).toHaveLength(2);
        expect(harness.companies.filter((company) => company.unifiedSocialCreditCode === USCC)).toHaveLength(1);
        expect(harness.companies[0]?.legalNameZh).toBe('义乌市实验服有限公司');
        expect(harness.companies[0]?.role).toBe('DIRECT_FACTORY');
        expect(harness.contacts.map((contact) => contact.value).sort()).toEqual([
            '+86-579-0000',
            'https://shop.example/coat',
            'sales@lab.example',
        ]);
        expect(harness.offers).toHaveLength(3);
        expect(harness.offers[0]?.price).toBe(PRICE);
        expect(harness.offers[0]?.layer).toBe('FACTORY');
        expect(harness.offers[0]?.quoteText).toBe('хлопок, от 500 штук');
        expect(harness.offers[0]?.company).toBe(harness.companies[0]);
        expect(harness.offers[1]?.company).toBe(harness.companies[0]);
        expect(harness.runs).toHaveLength(3);
        expect(harness.runs.map((run) => run.dossierStatus).sort()).toEqual(['complete', 'complete', 'partial']);
        expect(harness.runs[0]?.summaryRu).toBe('Завод в Иу, витрина 1688 открылась.');
        expect(JSON.stringify(firstBody)).not.toContain(PRICE);
        expect(JSON.stringify(firstBody)).not.toContain('CNY');
        expect(JSON.stringify(thirdBody)).not.toContain('990');
        expect(JSON.stringify(firstBody)).not.toContain('Завод в Иу');
    });

    it('повтор с тем же payload sha256 идемпотентен; другое тело на тот же run_id даёт 409', async () => {
        const harness = buildHarness();
        const app = await boot(harness.runner);
        const runId = randomUUID();
        const body = trial(harness.inquiry.id, runId);

        const created = await post(app, TOKEN, body);
        const again = await post(app, TOKEN, body);
        const changed = await post(app, TOKEN, { ...body, summary_ru: 'другой текст' });

        await app.close();

        expect(JSON.parse(created.body).data.duplicate).toBe(false);
        expect(again.statusCode).toBe(200);
        expect(JSON.parse(again.body).data).toMatchObject({
            duplicate: true,
            research_run_id: JSON.parse(created.body).data.research_run_id,
            counts: { companies: 1, offers: 1, contacts: 1 },
        });
        expect(changed.statusCode).toBe(409);
        expect(JSON.parse(changed.body).error.code).toBe('RUN_ID_REUSED');
        expect(harness.runs).toHaveLength(1);
        expect(harness.offers).toHaveLength(1);
        expect(harness.contacts).toHaveLength(1);
        expect(harness.runs[0]?.summaryRu).toBe('Завод в Иу, витрина 1688 открылась.');
    });

    it('отклоняет чужой токен, неизвестную заявку, чужую категорию и закрытую заявку', async () => {
        const harness = buildHarness();
        const app = await boot(harness.runner);
        const body = trial(harness.inquiry.id, randomUUID());

        const missing = await post(app, null, body);
        const wrong = await post(app, 'admin-api-token', body);
        const absent = await post(app, TOKEN, { ...body, inquiry_id: randomUUID(), run_id: randomUUID() });
        const category = await post(app, TOKEN, { ...body, run_id: randomUUID(), category: 'auto' });

        harness.inquiry.status = InquiryStatus.CLOSED;
        const closed = await post(app, TOKEN, { ...body, run_id: randomUUID() });

        await app.close();

        expect(missing.statusCode).toBe(401);
        expect(wrong.statusCode).toBe(401);
        expect(absent.statusCode).toBe(404);
        expect(category.statusCode).toBe(422);
        expect(JSON.parse(category.body).error.code).toBe('RESEARCH_CATEGORY_MISMATCH');
        expect(closed.statusCode).toBe(409);
        expect(harness.offers).toHaveLength(0);
        expect(harness.runs).toHaveLength(0);
        expect(harness.inquiry.status).toBe(InquiryStatus.CLOSED);
    });
});
