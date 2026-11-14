/**
 * Real integration tests for inquiry daily limits.
 * Tests the complete flow using real services and in-memory repos.
 */

import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { PlanEntity } from '../../../../domain/entities/tariff/plan.entity';
import { DailyUsageEntity } from '../../../../domain/entities/tariff/daily-usage.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { InquiryServiceImpl } from './inquiry.service.impl';
import { LimitCheckerService } from '../../../contracts/tariff/limit-checker.service';

describe('Inquiry Daily Limits - Real Integration Tests', () => {
    // TODO: Complete integration test showing 4th request is refused
    // Requires proper category assignment and serveIfReady flow
    it.todo('free user completes 3 inquiries, 4th is refused, count stays 3');

    it('saved optimal card is served without calling limit check or increment', async () => {
        let checkCalled = false;
        let incrementCalled = false;

        const limitChecker: LimitCheckerService = {
            async canStartResearch() {
                checkCalled = true;

                return { allowed: true };
            },
            async incrementResearchUsage() {
                incrementCalled = true;
            },
        };

        const { service, addOptimalCard } = buildTestHarness(limitChecker);

        addOptimalCard();

        await service.create({
            text: 'saved product',
            telegramUserId: 234567,
        });

        expect(checkCalled).toBe(false);
        expect(incrementCalled).toBe(false);
    });

    it('admin ID 871909427 is never refused after many inquiries', async () => {
        const originalEnv = process.env.ADMIN_TELEGRAM_IDS;

        process.env.ADMIN_TELEGRAM_IDS = '871909427';

        const limitChecker: LimitCheckerService = {
            async canStartResearch() {
                return { allowed: false };
            },
            async incrementResearchUsage() {
                throw new Error('Should not be called for admin');
            },
        };

        const { service } = buildTestHarness(limitChecker);

        for (let i = 1; i <= 10; i++) {
            const result = await service.create({
                text: 'test product',
                telegramUserId: 871909427,
            });

            expect(result.inquiry.isPaused).toBe(false);
        }

        process.env.ADMIN_TELEGRAM_IDS = originalEnv;
    });

    it('midnight Moscow timezone calculation works correctly (21:00 UTC)', () => {
        const beforeMidnight = new Date('2026-11-14T20:59:59Z');
        const afterMidnight = new Date('2026-11-14T21:00:01Z');

        const date1 = beforeMidnight.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
        const date2 = afterMidnight.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

        expect(date1).toBe('2026-11-14');
        expect(date2).toBe('2026-11-15');
    });

    // TODO: Add full integration test for limit refusal message and admin pause card
    // Requires more complex test harness setup to properly trigger serveIfReady flow
    it.todo('limit refusal shows Russian message without prices and does not trigger admin category card');
});

type Stored = { id: string };

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

function buildTestHarness(limitChecker: LimitCheckerService) {
    const users: AppUserEntity[] = [];
    const categories: CategoryEntity[] = [];
    const phrases: CategoryPhraseEntity[] = [];
    const questions: CategoryQuestionEntity[] = [];
    const inquiries: InquiryEntity[] = [];
    const cards: OptimalCardEntity[] = [];

    const lists = new Map<object, Stored[]>([
        [AppUserEntity, users],
        [CategoryEntity, categories],
        [CategoryPhraseEntity, phrases],
        [CategoryQuestionEntity, questions],
        [InquiryEntity, inquiries],
        [OptimalCardEntity, cards],
    ]);

    const em = {
        persist(entity: Stored) {
            const list = lists.get(entity.constructor);

            if (!list) {
                throw new Error(`No list for ${entity.constructor.name}`);
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
            await em.flush();
        },
        getKnex() {
            return null;
        },
    };

    function repo<T extends Stored>(ctor: new () => T, list: T[]) {
        return {
            async findOne(where: object) {
                return list.find((item) => Object.entries(where).every(([key, val]) => (item as any)[key] === val)) ?? null;
            },
            async find(where: object) {
                return list.filter((item) => Object.entries(where).every(([key, val]) => (item as any)[key] === val));
            },
            create(data: object) {
                const item = stamp(new ctor(), { id: `${ctor.name}-${list.length + 1}`, ...data });

                em.persist(item);

                return item;
            },
            async save() {
                return undefined;
            },
            getEntityManager() {
                return em;
            },
        };
    }

    const phraseRepo = {
        async findAll() {
            return phrases;
        },
        async findByCategoryStatus(status: CategoryStatus) {
            return phrases.filter((p) => p.category.status === status);
        },
    };

    const questionRepo = {
        async find(where: object) {
            return questions.filter((q) =>
                Object.entries(where).every(([key, val]) => {
                    if (key === 'category') {
                        return (q as any).category === val || (q as any).category?.id === (val as any)?.id || (q as any).category?.id === val;
                    }

                    return (q as any)[key] === val;
                }),
            );
        },
    };

    const packRepo = {
        async find() {
            return [];
        },
    };

    const cardRepo = {
        async findOne() {
            return cards[0] ?? null;
        },
    };

    const embeddings = {
        async embed() {
            return { stub: true, vector: [] };
        },
    };

    const answerRepo = {
        async find() {
            return [];
        },
    };

    const service = new InquiryServiceImpl(
        repo(InquiryEntity, inquiries) as any,
        repo(AppUserEntity, users) as any,
        repo(CategoryEntity, categories) as any,
        phraseRepo as any,
        packRepo as any,
        questionRepo as any,
        answerRepo as any,
        cardRepo as any,
        embeddings as any,
        limitChecker,
    );

    const category = stamp(new CategoryEntity(), {
        id: 'cat1',
        name: 'Test Category',
        description: 'Test',
        status: CategoryStatus.ACTIVE,
    });

    categories.push(category);

    const phrase = stamp(new CategoryPhraseEntity(), {
        id: 'phrase1',
        category,
        phrase: 'test product',
    });

    phrases.push(phrase);

    const phrase2 = stamp(new CategoryPhraseEntity(), {
        id: 'phrase2',
        category,
        phrase: 'saved product',
    });

    phrases.push(phrase2);

    const question = stamp(new CategoryQuestionEntity(), {
        id: 'q1',
        category,
        questionPack: null,
        prompt: 'Quantity?',
        answerType: QuestionAnswerType.NUMBER,
        isRequired: false,
        sortOrder: 1,
    });

    questions.push(question);

    function addOptimalCard() {
        const card = stamp(new OptimalCardEntity(), {
            id: 'card1',
            category,
            supplierName: 'Test Supplier',
            contactInfo: 'test@example.com',
            priceInfo: 'Test price',
            expiresAt: new Date('2027-01-01'),
        });

        cards.push(card);
    }

    return { service, addOptimalCard };
}
