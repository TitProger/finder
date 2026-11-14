import 'reflect-metadata';

import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Module } from '@nestjs/common';

import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { InquiryAnswerEntity } from '../../../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ManualEconomicsEntity } from '../../../../domain/entities/market/manual-economics.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { MarketPriceLayer } from '../../../../domain/enums/market-price-layer.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { CategoryPhraseRepository } from '../../../../domain/repositories/category/category-phrase.repository';
import { CategoryQuestionRepository } from '../../../../domain/repositories/category/category-question.repository';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { QuestionPackRepository } from '../../../../domain/repositories/category/question-pack.repository';
import { InquiryAnswerRepository } from '../../../../domain/repositories/inquiry/inquiry-answer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { ManualEconomicsRepository } from '../../../../domain/repositories/market/manual-economics.repository';
import { OptimalCardRepository } from '../../../../domain/repositories/market/optimal-card.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { LimitCheckerService } from '../../contracts/tariff/limit-checker.service';
import { InquiryServiceImpl } from '../inquiry/inquiry.service.impl';
import { ApiExceptionFilter } from '../../../../interfaces/http/filters/api-exception.filter';
import { AdminTokenGuard } from '../../../../interfaces/http/auth/admin-token.guard';
import { InquiryEconomicsController } from '../../../../interfaces/http/controllers/inquiry/inquiry-economics.controller';
import { ApiResponseInterceptor } from '../../../../interfaces/http/interceptors/api-response.interceptor';
import { TelegramDialog } from '../../../../interfaces/telegram/telegram-dialog';
import { TelegramOutgoing } from '../../../../interfaces/telegram/telegram.types';
import { INQUIRY_ECONOMICS, InquiryEconomicsService, InquiryEconomicsView } from './inquiry-economics.service';

const ADMIN = 111000111;
const CLIENT = 777001;
const ADMIN_TOKEN = 'economics-admin-token';
const CLIENT_PRICE = /\d+(?:[.,]\d+)?\s*(?:CNY|USD|RUB|руб\.?|¥|\$)/i;

type Stored = { id: string };

const state: { economics: InquiryEconomicsService | null } = { economics: null };

@Module({
    controllers: [InquiryEconomicsController],
    providers: [
        { provide: APP_GUARD, useClass: AdminTokenGuard },
        {
            provide: INQUIRY_ECONOMICS,
            useFactory: () => {
                if (!state.economics) {
                    throw new Error('economics is not ready');
                }

                return state.economics;
            },
        },
    ],
})
class EconomicsHttpModule {}

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
        dated.createdAt = new Date('2026-11-14T10:00:00Z');
    }

    if (dated.updatedAt === undefined) {
        dated.updatedAt = null;
    }

    return entity;
}

function restoreEnv(name: string, previous: string | undefined): void {
    if (previous === undefined) {
        delete process.env[name];

        return;
    }

    process.env[name] = previous;
}

function build() {
    const users: AppUserEntity[] = [];
    const phrases: CategoryPhraseEntity[] = [];
    const packs: QuestionPackEntity[] = [];
    const questions: CategoryQuestionEntity[] = [];
    const inquiries: InquiryEntity[] = [];
    const answers: InquiryAnswerEntity[] = [];
    const cards: OptimalCardEntity[] = [];
    const runs: ResearchRunEntity[] = [];
    const offers: OfferEntity[] = [];
    const economics: ManualEconomicsEntity[] = [];
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
    const runRepo = repo(ResearchRunEntity, runs);
    const offerRepo = repo(OfferEntity, offers);
    const economicsRepo = repo(ManualEconomicsEntity, economics);
    const limitChecker: LimitCheckerService = {
        async canStartResearch() {
            return { allowed: true };
        },
        async incrementResearchUsage() {
            return undefined;
        },
    };
    const inquiriesService = new InquiryServiceImpl(
        inquiryRepo as unknown as InquiryRepository,
        userRepo as unknown as AppUserRepository,
        repo(CategoryEntity, []) as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        repo(QuestionPackEntity, packs) as unknown as QuestionPackRepository,
        repo(CategoryQuestionEntity, questions) as unknown as CategoryQuestionRepository,
        repo(InquiryAnswerEntity, answers) as unknown as InquiryAnswerRepository,
        repo(OptimalCardEntity, cards) as unknown as OptimalCardRepository,
        limitChecker,
    );
    const service = new InquiryEconomicsService(
        inquiryRepo as unknown as InquiryRepository,
        runRepo as unknown as ResearchRunRepository,
        offerRepo as unknown as OfferRepository,
        economicsRepo as unknown as ManualEconomicsRepository,
    );
    const dialog = new TelegramDialog(inquiriesService, {} as never, {} as never, {
        deliver(message) {
            sent.push(message);

            return Promise.resolve();
        },
    }, undefined, undefined, service);

    const client = stamp(new AppUserEntity(), {
        role: UserRole.CLIENT,
        telegramUserId: String(CLIENT),
        isActive: true,
        planCode: 'free',
    });

    users.push(client);

    return { users, inquiries, runs, offers, economics, sent, service, dialog, client };
}

function seedDossier(
    harness: ReturnType<typeof build>,
    fx: unknown,
    rows: { layer: MarketPriceLayer; unit: string; price: string; currency: string }[],
): InquiryEntity {
    const inquiry = stamp(new InquiryEntity(), {
        clientUser: harness.client,
        status: InquiryStatus.DOSSIER_WITH_ADMIN,
        rawText: 'халат',
        isPaused: false,
        category: null,
    });
    const run = stamp(new ResearchRunEntity(), {
        inquiry,
        source: 'test',
        status: ResearchRunStatus.SUCCEEDED,
        finishedAt: new Date('2026-11-14T12:00:00Z'),
        dossierStatus: 'complete',
        payloadSha256: 'abc',
        fx,
    });

    harness.inquiries.push(inquiry);
    harness.runs.push(run);

    for (const row of rows) {
        harness.offers.push(
            stamp(new OfferEntity(), {
                researchRun: run,
                sourceUrl: `https://example.test/${row.layer}/${row.unit}/${row.price}`,
                layer: row.layer,
                unit: row.unit,
                price: row.price,
                currency: row.currency,
            }),
        );
    }

    return inquiry;
}

function quote(view: InquiryEconomicsView, layer: MarketPriceLayer, unit: string) {
    return view.quotes.find((item) => item.layer === layer && item.unit === unit);
}

describe('слои цен и ручная экономика', () => {
    const previousAdmin = process.env.ADMIN_TELEGRAM_IDS;
    const previousToken = process.env.ADMIN_API_TOKEN;
    const previousCny = process.env.FX_FALLBACK_CNY_RUB;

    afterAll(() => {
        restoreEnv('ADMIN_TELEGRAM_IDS', previousAdmin);
        restoreEnv('ADMIN_API_TOKEN', previousToken);
        restoreEnv('FX_FALLBACK_CNY_RUB', previousCny);
    });

    it('считает мин и медиану по слою и единице, переводя курс досье в рубли', async () => {
        const harness = build();
        const inquiry = seedDossier(harness, { cny_rub: 12, usd_rub: 80 }, [
            { layer: MarketPriceLayer.FACTORY, unit: 'piece', price: '10', currency: 'CNY' },
            { layer: MarketPriceLayer.FACTORY, unit: 'piece', price: '30', currency: 'CNY' },
            { layer: MarketPriceLayer.FACTORY, unit: 'piece', price: '20', currency: 'CNY' },
            { layer: MarketPriceLayer.FACTORY, unit: 'set', price: '5', currency: 'CNY' },
            { layer: MarketPriceLayer.FACTORY, unit: 'piece', price: '1', currency: 'EUR' },
            { layer: MarketPriceLayer.CHINA_OPEN, unit: 'piece', price: '10', currency: 'CNY' },
            { layer: MarketPriceLayer.CHINA_OPEN, unit: 'piece', price: '40', currency: 'CNY' },
            { layer: MarketPriceLayer.RUSSIA_RETAIL, unit: 'piece', price: '300', currency: 'RUB' },
            { layer: MarketPriceLayer.RUSSIA_WHOLESALE, unit: 'piece', price: '250', currency: 'RUB' },
        ]);
        const view = await harness.service.view(inquiry.id);
        const factoryPiece = quote(view, MarketPriceLayer.FACTORY, 'piece');
        const factorySet = quote(view, MarketPriceLayer.FACTORY, 'set');
        const open = quote(view, MarketPriceLayer.CHINA_OPEN, 'piece');
        const retail = quote(view, MarketPriceLayer.RUSSIA_RETAIL, 'piece');
        const wholesale = quote(view, MarketPriceLayer.RUSSIA_WHOLESALE, 'piece');

        expect(factoryPiece).toMatchObject({ count: 3, minRub: 120, medianRub: 240, fxUsed: 'dossier' });
        expect(factorySet).toMatchObject({ count: 1, minRub: 60, medianRub: 60, fxUsed: 'dossier' });
        expect(open).toMatchObject({ count: 2, minRub: 120, medianRub: 300, fxUsed: 'dossier' });
        expect(retail).toMatchObject({ minRub: 300, medianRub: 300, fxUsed: 'rub' });
        expect(wholesale).toMatchObject({ minRub: 250, fxUsed: 'rub' });
        expect(view.fxFallback).toBe(false);
        expect(view.economics).toBeNull();
        expect(view.landed).toEqual([]);
        expect(view.quotes.map((item) => item.layer)).toEqual([
            MarketPriceLayer.FACTORY,
            MarketPriceLayer.FACTORY,
            MarketPriceLayer.CHINA_OPEN,
            MarketPriceLayer.RUSSIA_RETAIL,
            MarketPriceLayer.RUSSIA_WHOLESALE,
        ]);
    });

    it('помечает запасной курс, если в досье нет cny_rub', async () => {
        process.env.FX_FALLBACK_CNY_RUB = '11';
        const harness = build();
        const inquiry = seedDossier(harness, { usd_rub: 80 }, [
            { layer: MarketPriceLayer.FACTORY, unit: 'piece', price: '10', currency: 'CNY' },
            { layer: MarketPriceLayer.RUSSIA_RETAIL, unit: 'piece', price: '400', currency: 'RUB' },
        ]);
        const view = await harness.service.view(inquiry.id);

        expect(quote(view, MarketPriceLayer.FACTORY, 'piece')).toMatchObject({
            minRub: 110,
            medianRub: 110,
            fxUsed: 'fallback',
        });
        expect(quote(view, MarketPriceLayer.RUSSIA_RETAIL, 'piece')?.fxUsed).toBe('rub');
        expect(view.fxFallback).toBe(true);
        restoreEnv('FX_FALLBACK_CNY_RUB', previousCny);
    });

    it('считает себестоимость и сравнивает её с розницей, не заполняя цену клиента', async () => {
        const harness = build();
        const inquiry = seedDossier(harness, { cny_rub: 12, usd_rub: 80 }, [
            { layer: MarketPriceLayer.FACTORY, unit: 'piece', price: '10', currency: 'CNY' },
            { layer: MarketPriceLayer.FACTORY, unit: 'set', price: '5', currency: 'CNY' },
            { layer: MarketPriceLayer.RUSSIA_RETAIL, unit: 'piece', price: '300', currency: 'RUB' },
        ]);
        const saved = await harness.service.save(inquiry.id, {
            deliveryPerUnit: 30,
            dutyPercent: 10,
            otherCost: 5,
            markupPercent: 25,
        });
        const piece = saved.landed.find((item) => item.unit === 'piece');
        const set = saved.landed.find((item) => item.unit === 'set');
        const row = harness.economics[0];

        expect(piece).toMatchObject({
            baseRub: 120,
            dutyAmount: 12,
            otherCost: 5,
            markupAmount: 41.75,
            landedRub: 208.75,
            retailRub: 300,
            deltaRub: 91.25,
            verdict: 'выгодно',
            fxUsed: 'dossier',
        });
        expect(set).toMatchObject({ landedRub: 126.25, retailRub: null, deltaRub: null, verdict: null });
        expect(row.clientPrice ?? null).toBeNull();
        expect(row.logisticsCost).toBe('30');
        expect(row.dutyPercent).toBe('10');
        expect(row.otherCost).toBe('5');
        expect(row.markupPercent).toBe('25');
        expect(row.dutyCost).toBe('12');
        expect(row.markupAmount).toBe('41.75');
        expect(row.note).toContain('курс:dossier');
        expect(row.currency).toBe('RUB');
        expect(harness.economics).toHaveLength(1);

        const again = await harness.service.save(inquiry.id, {
            deliveryPerUnit: 30,
            dutyPercent: 10,
            otherCost: 5,
            markupPercent: 25,
        });

        expect(harness.economics).toHaveLength(1);
        expect(again.landed.find((item) => item.unit === 'piece')?.landedRub).toBe(208.75);
    });

    it('принимает строку менеджера, отвергает плохую и не показывает цену клиенту', async () => {
        process.env.ADMIN_TELEGRAM_IDS = String(ADMIN);
        const harness = build();
        const inquiry = seedDossier(harness, { cny_rub: 12, usd_rub: 80 }, [
            { layer: MarketPriceLayer.FACTORY, unit: 'piece', price: '10', currency: 'CNY' },
            { layer: MarketPriceLayer.FACTORY, unit: 'set', price: '5', currency: 'CNY' },
            { layer: MarketPriceLayer.RUSSIA_RETAIL, unit: 'piece', price: '300', currency: 'RUB' },
        ]);

        await harness.dialog.handle({
            kind: 'callback',
            chatId: CLIENT,
            telegramUserId: CLIENT,
            callbackQueryId: 'client-ec',
            data: `ec:${inquiry.id}`,
        });
        expect(harness.economics).toHaveLength(0);
        expect(harness.sent.filter((item) => item.chatId === CLIENT).map((item) => item.text).join('\n')).toContain(
            'Это действие для админа.',
        );

        await harness.dialog.handle({
            kind: 'callback',
            chatId: ADMIN,
            telegramUserId: ADMIN,
            callbackQueryId: 'admin-ec',
            data: `ec:${inquiry.id}`,
        });
        await harness.dialog.handle({
            kind: 'message',
            chatId: ADMIN,
            telegramUserId: ADMIN,
            text: 'доставка=нет пошлина=10 наценка=25',
            photoFileIds: [],
        });
        await harness.dialog.handle({
            kind: 'message',
            chatId: ADMIN,
            telegramUserId: ADMIN,
            text: 'доставка=-5 пошлина=10 наценка=25',
            photoFileIds: [],
        });
        await harness.dialog.handle({
            kind: 'message',
            chatId: ADMIN,
            telegramUserId: ADMIN,
            text: 'доставка=30 пошлина=10',
            photoFileIds: [],
        });
        expect(harness.economics).toHaveLength(0);

        await harness.dialog.handle({
            kind: 'message',
            chatId: ADMIN,
            telegramUserId: ADMIN,
            text: 'доставка=30 пошлина=10 наценка=25 прочее=5',
            photoFileIds: [],
        });

        const adminText = harness.sent
            .filter((item) => item.chatId === ADMIN)
            .map((item) => item.text)
            .join('\n');

        expect(adminText).toContain('Себестоимость: 208.75 RUB');
        expect(adminText).toContain('Розница РФ: 300 RUB');
        expect(adminText).toContain('Выгодно.');
        expect(adminText).toContain('Себестоимость: 126.25 RUB');
        expect(adminText).toContain('вердикта нет');
        expect(harness.economics).toHaveLength(1);
        expect(harness.economics[0].clientPrice ?? null).toBeNull();

        await harness.dialog.handle({
            kind: 'message',
            chatId: CLIENT,
            telegramUserId: CLIENT,
            text: 'доставка=30 пошлина=10 наценка=25 прочее=5',
            photoFileIds: [],
        });

        const clientText = harness.sent
            .filter((item) => item.chatId === CLIENT)
            .map((item) => item.text)
            .join('\n');

        expect(clientText).toContain('Менеджер уточняет направление.');
        expect(clientText).not.toContain('208.75');
        expect(clientText).not.toContain('126.25');
        expect(clientText).not.toContain('300 RUB');
        expect(clientText).not.toMatch(CLIENT_PRICE);
        expect(harness.economics).toHaveLength(1);
        expect(harness.economics[0].inquiry.id).toBe(inquiry.id);
    });

    it('отдаёт себестоимость админским токеном и отвергает запрос без него', async () => {
        process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
        const harness = build();
        const inquiry = seedDossier(harness, { cny_rub: 12 }, [
            { layer: MarketPriceLayer.FACTORY, unit: 'piece', price: '10', currency: 'CNY' },
            { layer: MarketPriceLayer.RUSSIA_RETAIL, unit: 'piece', price: '300', currency: 'RUB' },
        ]);

        state.economics = harness.service;
        const app = await NestFactory.create<NestFastifyApplication>(EconomicsHttpModule, new FastifyAdapter(), {
            logger: false,
        });

        app.useGlobalInterceptors(new ApiResponseInterceptor());
        app.useGlobalFilters(new ApiExceptionFilter(app.get(HttpAdapterHost)));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const denied = await app.getHttpAdapter().getInstance().inject({
            method: 'POST',
            url: `/admin/inquiries/${inquiry.id}/economics`,
            payload: { deliveryPerUnit: 30, dutyPercent: 10, otherCost: 5, markupPercent: 25 },
        });
        const bad = await app.getHttpAdapter().getInstance().inject({
            method: 'POST',
            url: `/admin/inquiries/${inquiry.id}/economics`,
            headers: { authorization: `Bearer ${ADMIN_TOKEN}`, 'content-type': 'application/json' },
            payload: JSON.stringify({ deliveryPerUnit: 30, dutyPercent: -1, markupPercent: 25 }),
        });
        const allowed = await app.getHttpAdapter().getInstance().inject({
            method: 'POST',
            url: `/admin/inquiries/${inquiry.id}/economics`,
            headers: { authorization: `Bearer ${ADMIN_TOKEN}`, 'content-type': 'application/json' },
            payload: JSON.stringify({ deliveryPerUnit: 30, dutyPercent: 10, otherCost: 5, markupPercent: 25 }),
        });
        const loaded = await app.getHttpAdapter().getInstance().inject({
            method: 'GET',
            url: `/admin/inquiries/${inquiry.id}/economics`,
            headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        });

        await app.close();

        const saved = allowed.json() as { data: InquiryEconomicsView };
        const read = loaded.json() as { data: InquiryEconomicsView };

        expect(denied.statusCode).toBe(401);
        expect(bad.statusCode).toBe(400);
        expect(harness.economics).toHaveLength(1);
        expect(allowed.statusCode).toBe(200);
        expect(saved.data.landed[0]).toMatchObject({ landedRub: 208.75, verdict: 'выгодно', retailRub: 300 });
        expect(saved.data.economics?.deliveryPerUnit).toBe(30);
        expect(JSON.stringify(saved.data)).not.toContain('clientPrice');
        expect(loaded.statusCode).toBe(200);
        expect(read.data.landed[0].landedRub).toBe(208.75);
        expect(read.data.fxFallback).toBe(false);
    });
});
