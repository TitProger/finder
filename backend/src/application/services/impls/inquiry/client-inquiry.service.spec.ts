import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { CategoryPhraseRepository } from '../../../../domain/repositories/category/category-phrase.repository';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { QuestionPackRepository } from '../../../../domain/repositories/category/question-pack.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { TaxonomyNodeRepository } from '../../../../domain/repositories/taxonomy/taxonomy-node.repository';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { DossierService } from '../../contracts/market/dossier.service';
import { ResearchQueueService } from '../../contracts/research/research-queue.service';
import { StoredFileService } from '../file/stored-file.service';
import { ClientInquiryServiceImpl } from './client-inquiry.service.impl';

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

function build() {
    const users: AppUserEntity[] = [];
    const categories: CategoryEntity[] = [];
    const phrases: CategoryPhraseEntity[] = [];
    const inquiries: InquiryEntity[] = [];
    const createdUsers: Array<Record<string, unknown>> = [];
    const lists = new Map<object, Stored[]>();
    const em = {
        persist(entity: Stored) {
            const list = lists.get(entity.constructor);

            if (!list) {
                throw new Error(`Нет списка для ${entity.constructor.name}`);
            }

            if (!list.some((item) => item.id === entity.id)) {
                list.push(entity);
            }

            return em;
        },
        async flush() {
            return undefined;
        },
    };

    function repo<T extends Stored>(Ctor: new () => T, items: T[]) {
        lists.set(Ctor, items);

        return {
            create(data: object) {
                if (Ctor === (AppUserEntity as unknown as new () => T)) {
                    createdUsers.push(data as Record<string, unknown>);
                }

                const entity = stamp(new Ctor(), data);

                return entity;
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
    const enqueued: InquiryEntity[] = [];
    const files = {
        async requireIds(ids: readonly string[]) {
            return [...ids];
        },
    };
    const researchQueue = {
        async enqueue(inquiry: InquiryEntity) {
            enqueued.push(inquiry);
            inquiry.status = InquiryStatus.QUEUED_RESEARCH;

            return inquiry;
        },
    };
    const dossiers = {
        async findLiveForRequest() {
            return null;
        },
    };
    const service = new ClientInquiryServiceImpl(
        repo(InquiryEntity, inquiries) as unknown as InquiryRepository,
        repo(AppUserEntity, users) as unknown as AppUserRepository,
        repo(CategoryEntity, categories) as unknown as CategoryRepository,
        phraseRepo as unknown as CategoryPhraseRepository,
        repo(class Pack {}, []) as unknown as QuestionPackRepository,
        { findOne: async () => null } as unknown as TaxonomyNodeRepository,
        files as unknown as StoredFileService,
        researchQueue as unknown as ResearchQueueService,
        dossiers as unknown as DossierService,
    );

    return { service, categories, phrases, createdUsers, enqueued, users };
}

function matches(entity: object, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, expected]) => (entity as Record<string, unknown>)[key] === expected);
}

describe('клиентская заявка сайта', () => {
    it('создаёт заявку по тексту без telegramUserId и без тарифа', async () => {
        const harness = build();
        const category = stamp(new CategoryEntity(), {
            name: 'Насосы',
            description: 'Насосы',
            status: CategoryStatus.ACTIVE,
            code: 'pumps',
        });

        harness.categories.push(category);
        harness.phrases.push(stamp(new CategoryPhraseEntity(), { category, phrase: 'насос для дачи' }));

        const inquiry = await harness.service.create({
            text: '  насос для дачи  ',
            mediaIds: ['file-1'],
        });

        expect(harness.createdUsers).toEqual([
            {
                role: UserRole.CLIENT,
                displayName: 'web',
                isActive: true,
            },
        ]);
        expect(harness.createdUsers[0]).not.toHaveProperty('telegramUserId');
        expect(harness.createdUsers[0]).not.toHaveProperty('planCode');
        expect(inquiry.rawText).toBe('насос для дачи');
        expect(inquiry.photoUrls).toEqual(['file-1']);
        expect(inquiry.clientUser.role).toBe(UserRole.CLIENT);
        expect(inquiry.clientUser.displayName).toBe('web');
        expect(inquiry.status).toBe(InquiryStatus.QUEUED_RESEARCH);
        expect(harness.enqueued).toEqual([inquiry]);
        expect(JSON.stringify(inquiry)).not.toContain('telegramUserId');
    });
});
