import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { CompanyEntity } from '../../../../domain/entities/catalog/company.entity';
import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { StorefrontEntity } from '../../../../domain/entities/catalog/storefront.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { MarketSnapshotEntity } from '../../../../domain/entities/market/market-snapshot.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { MarketPriceLayer } from '../../../../domain/enums/market-price-layer.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { SupplierRole } from '../../../../domain/enums/supplier-role.enum';
import { CompanyRepository } from '../../../../domain/repositories/catalog/company.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { StorefrontRepository } from '../../../../domain/repositories/catalog/storefront.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { MarketSnapshotRepository } from '../../../../domain/repositories/market/market-snapshot.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { OFFER_TTL_MS, SNAPSHOT_TTL_MS, addTtl } from '../../../../domain/research/dossier-clock';
import { JsonResearchRunner } from './json-research-runner';

type Stored = { id: string };

type FakeEm = {
    persist(entity: Stored): FakeEm;
    flush(): Promise<void>;
    transactional<T>(work: (tx: FakeEm) => Promise<T>): Promise<T>;
};

function matches(entity: object, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, expected]) => (entity as Record<string, unknown>)[key] === expected);
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
    const storefronts: StorefrontEntity[] = [];
    const offers: OfferEntity[] = [];
    const runs: ResearchRunEntity[] = [];
    const snapshots: MarketSnapshotEntity[] = [];
    const lists = new Map<object, Stored[]>();
    const em: FakeEm = {
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
        async transactional<T>(work: (tx: FakeEm) => Promise<T>): Promise<T> {
            return work(em);
        },
    };

    function repo<T extends Stored>(Ctor: new () => T, items: T[]) {
        lists.set(Ctor, items);

        return {
            create(data: object) {
                return stamp(new Ctor(), data);
            },
            findOne(where: Record<string, unknown>) {
                return Promise.resolve(items.find((item) => matches(item, where)) ?? null);
            },
            getEntityManager() {
                return em;
            },
        };
    }

    const inquiriesRepo = repo(InquiryEntity, inquiries);
    const category = stamp(new CategoryEntity(), {
        name: 'Халаты',
        description: 'без цены',
        status: CategoryStatus.ACTIVE,
        embedding: null,
    });
    const inquiry = stamp(new InquiryEntity(), {
        status: InquiryStatus.COLLECTING_ANSWERS,
        rawText: 'лабораторные халаты',
        photoUrls: [],
        category,
        isPaused: false,
    });

    em.persist(inquiry);

    const service = new JsonResearchRunner(
        inquiriesRepo as unknown as InquiryRepository,
        repo(CompanyEntity, companies) as unknown as CompanyRepository,
        repo(StorefrontEntity, storefronts) as unknown as StorefrontRepository,
        repo(OfferEntity, offers) as unknown as OfferRepository,
        repo(ResearchRunEntity, runs) as unknown as ResearchRunRepository,
        repo(MarketSnapshotEntity, snapshots) as unknown as MarketSnapshotRepository,
    );

    return { service, inquiry, companies, storefronts, offers, runs, snapshots };
}

const capturedAt = '2026-11-01T00:00:00.000Z';

function dossier() {
    return {
        companies: [
            {
                ref: 'plant',
                legalNameZh: '义乌市某某服饰有限公司',
                unifiedSocialCreditCode: '91330782MA2ABCDE1X',
                registryStatus: 'ACTIVE',
                address: '义乌',
                businessScope: '服装',
                insuredEmployeeCount: 40,
                storefronts: [
                    {
                        ref: 'shop',
                        platformName: '1688',
                        sellerExternalId: 'shop-1',
                        storefrontUrl: 'https://shop.1688.com/shop-1',
                        city: '义乌',
                        factoryLabels: { factory: true },
                    },
                ],
            },
        ],
        offers: [
            {
                companyRef: 'plant',
                storefrontRef: 'shop',
                sourceUrl: 'https://detail.1688.com/offer/1.html',
                price: 12.5,
                currency: 'cny',
                volumeTier: '100-499',
                moq: 100,
                quoteText: '100件起，单价12.5元',
                supplierRole: 'DIRECT_FACTORY',
                capturedAt,
            },
            {
                price: 1,
                quoteText: 'без адреса',
            },
        ],
        snapshots: [
            {
                layer: 'CHINA_OPEN',
                source: '1688',
                medianPrice: 12.5,
                currency: 'CNY',
                spreadLow: 10,
                spreadHigh: 15,
                samplePoints: [{ price: 12.5, url: 'https://detail.1688.com/offer/1.html', label: '1688' }],
                capturedAt,
            },
        ],
    };
}

describe('JsonResearchRunner', () => {
    it('создаёт company, storefront, offer и market_snapshot, а оффер без url не создаёт', async () => {
        const harness = buildHarness();
        const result = await harness.service.ingest(harness.inquiry.id, dossier());
        const captured = new Date(capturedAt);
        const offer = harness.offers[0];
        const snapshot = harness.snapshots[0];

        expect(result.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(harness.inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(harness.companies).toHaveLength(1);
        expect(harness.companies[0]?.legalNameZh).toBe('义乌市某某服饰有限公司');
        expect(harness.companies[0]?.unifiedSocialCreditCode).toBe('91330782MA2ABCDE1X');
        expect(harness.storefronts).toHaveLength(1);
        expect(harness.storefronts[0]?.platformName).toBe('1688');
        expect(harness.storefronts[0]?.storefrontUrl).toBe('https://shop.1688.com/shop-1');
        expect(harness.storefronts[0]?.company).toBe(harness.companies[0]);
        expect(harness.offers).toHaveLength(1);
        expect(offer?.sourceUrl).toBe('https://detail.1688.com/offer/1.html');
        expect(offer?.quoteText).toBe('100件起，单价12.5元');
        expect(offer?.price).toBe('12.5');
        expect(offer?.currency).toBe('CNY');
        expect(offer?.moq).toBe('100');
        expect(offer?.supplierRole).toBe(SupplierRole.DIRECT_FACTORY);
        expect(offer?.company).toBe(harness.companies[0]);
        expect(offer?.storefront).toBe(harness.storefronts[0]);
        expect(offer?.canonicalProduct ?? null).toBeNull();
        expect(offer?.expiresAt?.toISOString()).toBe(addTtl(captured, OFFER_TTL_MS).toISOString());
        expect(harness.snapshots).toHaveLength(1);
        expect(snapshot?.layer).toBe(MarketPriceLayer.CHINA_OPEN);
        expect(snapshot?.medianPrice).toBe('12.5');
        expect(snapshot?.spreadLow).toBe('10');
        expect(snapshot?.spreadHigh).toBe('15');
        expect(snapshot?.samplePoints).toEqual([
            { price: '12.5', url: 'https://detail.1688.com/offer/1.html', label: '1688' },
        ]);
        expect(snapshot?.expiresAt.toISOString()).toBe(addTtl(captured, SNAPSHOT_TTL_MS).toISOString());
        expect(snapshot?.inquiry).toBe(harness.inquiry);
        expect(snapshot?.researchRun).toBe(harness.runs[0]);
        expect(harness.runs).toHaveLength(1);
        expect(harness.runs[0]?.source).toBe('json_import');
        expect(harness.runs[0]?.status).toBe(ResearchRunStatus.SUCCEEDED);
        expect(harness.runs[0]?.failureReason).toBe('Оффер 2 отброшен: нет url. Цитата: «без адреса».');
        expect(result.offerIds).toEqual([offer?.id]);
        expect(result.discarded).toEqual(['Оффер 2 отброшен: нет url. Цитата: «без адреса».']);
    });

    it('мусор без url не создаёт offer и всё равно отдаёт досье админу', async () => {
        const harness = buildHarness();
        const result = await harness.service.ingest(harness.inquiry.id, {
            offers: [{ quoteText: 'мусор' }, { sourceUrl: '   ' }],
        });

        expect(harness.offers).toHaveLength(0);
        expect(harness.companies).toHaveLength(0);
        expect(result.offerIds).toEqual([]);
        expect(harness.inquiry.status).toBe(InquiryStatus.DOSSIER_WITH_ADMIN);
        expect(harness.runs[0]?.status).toBe(ResearchRunStatus.SUCCEEDED);
        expect(harness.runs[0]?.failureReason).toBe(
            'Оффер 1 отброшен: нет url. Цитата: «мусор».\nОффер 2 отброшен: нет url.',
        );
    });

    it('не пишет строки, если заявка на паузе, уже отдана из базы или досье кривое', async () => {
        const paused = buildHarness();

        paused.inquiry.isPaused = true;
        await expect(paused.service.ingest(paused.inquiry.id, dossier())).rejects.toBeInstanceOf(BadRequestAppException);
        expect(paused.offers).toHaveLength(0);
        expect(paused.runs).toHaveLength(0);
        expect(paused.inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);

        const served = buildHarness();

        served.inquiry.status = InquiryStatus.SERVED_FROM_DATABASE;
        await expect(served.service.ingest(served.inquiry.id, dossier())).rejects.toBeInstanceOf(BadRequestAppException);
        expect(served.offers).toHaveLength(0);
        expect(served.inquiry.status).toBe(InquiryStatus.SERVED_FROM_DATABASE);

        const broken = buildHarness();

        await expect(
            broken.service.ingest(broken.inquiry.id, {
                offers: [{ sourceUrl: 'https://detail.1688.com/offer/1.html', currency: 'юань' }],
            }),
        ).rejects.toBeInstanceOf(BadRequestAppException);
        expect(broken.offers).toHaveLength(0);
        expect(broken.runs).toHaveLength(0);
        expect(broken.inquiry.status).toBe(InquiryStatus.COLLECTING_ANSWERS);
        await expect(broken.service.ingest('missing', dossier())).rejects.toBeInstanceOf(NotFoundAppException);
    });
});
