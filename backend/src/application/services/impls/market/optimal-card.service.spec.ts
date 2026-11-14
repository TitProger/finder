import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { CanonicalProductEntity } from '../../../../domain/entities/catalog/canonical-product.entity';
import { CompanyEntity } from '../../../../domain/entities/catalog/company.entity';
import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { CompanyRegistryStatus } from '../../../../domain/enums/company-registry-status.enum';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { SupplierRole } from '../../../../domain/enums/supplier-role.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { CanonicalProductRepository } from '../../../../domain/repositories/catalog/canonical-product.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { CategoryQuestionRepository } from '../../../../domain/repositories/category/category-question.repository';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { OptimalCardRepository } from '../../../../domain/repositories/market/optimal-card.repository';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { OptimalCardServiceImpl } from './optimal-card.service.impl';

type Stored = { id: string };

type FakeEm = {
    persist(entity: Stored): FakeEm;
    flush(): Promise<void>;
    transactional(work: (tx: FakeEm) => Promise<void>): Promise<void>;
};

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
    const users: AppUserEntity[] = [];
    const categories: CategoryEntity[] = [];
    const questions: CategoryQuestionEntity[] = [];
    const products: CanonicalProductEntity[] = [];
    const offers: OfferEntity[] = [];
    const companies: CompanyEntity[] = [];
    const cards: OptimalCardEntity[] = [];
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
        async transactional(work: (tx: FakeEm) => Promise<void>) {
            await work(em);
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

    repo(CompanyEntity, companies);
    const service = new OptimalCardServiceImpl(
        repo(OptimalCardEntity, cards) as unknown as OptimalCardRepository,
        repo(CategoryEntity, categories) as unknown as CategoryRepository,
        repo(CategoryQuestionEntity, questions) as unknown as CategoryQuestionRepository,
        repo(CanonicalProductEntity, products) as unknown as CanonicalProductRepository,
        repo(OfferEntity, offers) as unknown as OfferRepository,
        repo(AppUserEntity, users) as unknown as AppUserRepository,
    );
    const save = <T extends Stored>(entity: T) => {
        em.persist(entity);

        return entity;
    };
    const admin = save(
        stamp(new AppUserEntity(), {
            role: UserRole.ADMIN,
            telegramUserId: null,
            login: 'admin',
            passwordHash: 'hash',
            displayName: 'Админ',
            isActive: true,
        }),
    );
    const category = save(
        stamp(new CategoryEntity(), {
            name: 'Халаты',
            description: 'без цены',
            status: CategoryStatus.ACTIVE,
            embedding: null,
        }),
    );
    const quantity = save(
        stamp(new CategoryQuestionEntity(), {
            category,
            questionPack: null,
            prompt: 'Сколько?',
            answerType: QuestionAnswerType.NUMBER,
            choices: null,
            isRequired: true,
            sortOrder: 0,
        }),
    );
    const fabric = save(
        stamp(new CategoryQuestionEntity(), {
            category,
            questionPack: null,
            prompt: 'Ткань?',
            answerType: QuestionAnswerType.TEXT,
            choices: null,
            isRequired: true,
            sortOrder: 1,
        }),
    );

    return { service, admin, category, quantity, fabric, companies, offers, save };
}

function cardInput(
    harness: ReturnType<typeof buildHarness>,
    extra: Record<string, unknown> = {},
) {
    return {
        adminUserId: harness.admin.id,
        categoryId: harness.category.id,
        qtyMin: 10,
        qtyMax: 100,
        quantityQuestionId: harness.quantity.id,
        productAttributes: { [harness.fabric.id]: 'хлопок' },
        nameRu: 'Халат хлопок',
        ...extra,
    };
}

describe('OptimalCardServiceImpl', () => {
    it('вручную создаёт карточку и ставит срок 30 дней', async () => {
        const harness = buildHarness();
        const before = Date.now();
        const card = await harness.service.create(cardInput(harness, { isLive: true, contactValue: 'wechat-1' }));
        const ttl = (card.expiresAt?.getTime() ?? 0) - before;

        expect(card.isLive).toBe(true);
        expect(card.canonicalProduct.nameRu).toBe('Халат хлопок');
        expect(card.contactAdminEntered).toBe(true);
        expect(card.contactUrl ?? null).toBeNull();
        expect(card.markedLiveByUser?.id).toBe(harness.admin.id);
        expect(ttl).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
        expect(ttl).toBeLessThan(31 * 24 * 60 * 60 * 1000);
    });

    it('повторная живая на тот же товар и диапазон снимает флаг, строка остаётся', async () => {
        const harness = buildHarness();
        const first = await harness.service.create(cardInput(harness, { isLive: true }));
        const second = await harness.service.create(
            cardInput(harness, {
                isLive: true,
                canonicalProductId: first.canonicalProduct.id,
                nameRu: null,
            }),
        );
        const kept = await harness.service.getById(first.id);

        expect(kept.isLive).toBe(false);
        expect(kept.id).toBe(first.id);
        expect(second.isLive).toBe(true);
        expect(second.canonicalProduct.id).toBe(first.canonicalProduct.id);
    });

    it('другой диапазон не снимает предыдущую живую', async () => {
        const harness = buildHarness();
        const first = await harness.service.create(cardInput(harness, { isLive: true, qtyMin: 10, qtyMax: 20 }));
        const second = await harness.service.create(
            cardInput(harness, {
                isLive: true,
                qtyMin: 30,
                qtyMax: 40,
                canonicalProductId: first.canonicalProduct.id,
                nameRu: null,
            }),
        );

        expect(first.isLive).toBe(true);
        expect(second.isLive).toBe(true);
    });

    it('собирает карточку из оффера и не ходит в парсер', async () => {
        const harness = buildHarness();
        const company = harness.save(
            stamp(new CompanyEntity(), {
                legalNameZh: '厂',
                unifiedSocialCreditCode: null,
                registryStatus: CompanyRegistryStatus.UNKNOWN,
                address: null,
                businessScope: null,
                insuredEmployeeCount: null,
            }),
        );
        const offer = harness.save(
            stamp(new OfferEntity(), {
                researchRun: null,
                canonicalProduct: null,
                company,
                storefront: null,
                categorySite: null,
                sourceUrl: 'https://factory.example/gown',
                price: '88',
                currency: 'cny',
                volumeTier: null,
                moq: null,
                quoteText: null,
                supplierRole: SupplierRole.UNVERIFIED,
                capturedAt: new Date(),
                expiresAt: null,
            }),
        );
        const card = await harness.service.create(
            cardInput(harness, {
                offerId: offer.id,
                nameRu: 'Халат с оффера',
            }),
        );

        expect(card.offer?.id).toBe(offer.id);
        expect(card.price).toBe('88');
        expect(card.currency).toBe('CNY');
        expect(card.contactUrl).toBe('https://factory.example/gown');
        expect(card.contactAdminEntered).toBe(false);
        expect(card.company?.id).toBe(company.id);
        expect(card.canonicalProduct.nameRu).toBe('Халат с оффера');
        expect(card.isLive).toBe(false);
    });

    it('правит цену и не принимает пустой диапазон или нечисловой вопрос объёма', async () => {
        const harness = buildHarness();
        const card = await harness.service.create(cardInput(harness, { price: 10, currency: 'usd' }));
        const updated = await harness.service.update(card.id, {
            adminUserId: harness.admin.id,
            price: 12,
            reasonNote: 'короче партия',
        });

        expect(updated.price).toBe('12');
        expect(updated.currency).toBe('USD');
        expect(updated.reasonNote).toBe('короче партия');
        expect(updated.isLive).toBe(false);
        await expect(harness.service.create(cardInput(harness, { qtyMin: 20, qtyMax: 5 }))).rejects.toBeInstanceOf(
            BadRequestAppException,
        );
        await expect(
            harness.service.create(cardInput(harness, { quantityQuestionId: harness.fabric.id })),
        ).rejects.toBeInstanceOf(BadRequestAppException);
        await expect(harness.service.create(cardInput(harness, { nameRu: '  ' }))).rejects.toBeInstanceOf(
            BadRequestAppException,
        );
    });
});
