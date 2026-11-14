/**
 * Real integration test for category seeder idempotency.
 * Tests that YAML seed can be run multiple times without duplicating data.
 */

import { CategoryEntity } from '../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../../domain/entities/category/category-site.entity';
import { QuestionPackEntity } from '../../../domain/entities/category/question-pack.entity';
import { CategoryStatus } from '../../../domain/enums/category-status.enum';
import { QuestionAnswerType } from '../../../domain/enums/question-answer-type.enum';
import { SiteRole } from '../../../domain/enums/site-role.enum';
import { CategorySeederService } from '../../../infrastructure/database/seeders/category-seeder.service';

describe('CategorySeeder (idempotency)', () => {
    it('should seed categories idempotently: no duplicates, updates work, admin categories preserved', async () => {
        const categories: CategoryEntity[] = [];
        const phrases: CategoryPhraseEntity[] = [];
        const questions: CategoryQuestionEntity[] = [];
        const sites: CategorySiteEntity[] = [];
        const packs: QuestionPackEntity[] = [];

        const em = {
            async persistAndFlush(entity: any) {
                if (entity instanceof CategoryEntity) {
                    const existing = categories.find((c) => c.code === entity.code);

                    if (existing) {
                        Object.assign(existing, entity);
                    } else {
                        categories.push(entity);
                    }
                }
            },
            persist(entity: any) {
                if (entity instanceof CategoryPhraseEntity) {
                    const existing = phrases.find((p) => p.phrase === entity.phrase && p.category === entity.category);

                    if (!existing) {
                        phrases.push(entity);
                    }
                } else if (entity instanceof CategoryQuestionEntity) {
                    const existing = questions.find(
                        (q) =>
                            q.code === entity.code &&
                            q.category === entity.category &&
                            q.questionPack === entity.questionPack,
                    );

                    if (existing) {
                        Object.assign(existing, entity);
                    } else {
                        questions.push(entity);
                    }
                } else if (entity instanceof QuestionPackEntity) {
                    const existing = packs.find((p) => p.code === entity.code && p.category === entity.category);

                    if (existing) {
                        Object.assign(existing, entity);
                    } else {
                        packs.push(entity);
                    }
                } else if (entity instanceof CategorySiteEntity) {
                    if (!sites.includes(entity)) {
                        sites.push(entity);
                    }
                }
            },
            async flush() {
                return undefined;
            },
            async findOne(Entity: any, where: any) {
                if (Entity === CategoryEntity) {
                    return categories.find((c) => c.code === where.code) || null;
                } else if (Entity === QuestionPackEntity) {
                    return (
                        packs.find((p) => p.code === where.code && p.category.id === where.category) || null
                    );
                } else if (Entity === CategoryQuestionEntity) {
                    return (
                        questions.find(
                            (q) =>
                                q.code === where.code &&
                                q.category.id === where.category &&
                                q.questionPack === where.questionPack,
                        ) || null
                    );
                }

                return null;
            },
            async find(Entity: any, where: any) {
                if (Entity === CategoryPhraseEntity) {
                    return phrases.filter((p) => p.category.id === where.category);
                } else if (Entity === CategorySiteEntity) {
                    return sites.filter((s) => s.category.id === where.category);
                }

                return [];
            },
            remove(entity: any) {
                if (entity instanceof CategorySiteEntity) {
                    const index = sites.indexOf(entity);

                    if (index >= 0) {
                        sites.splice(index, 1);
                    }
                }
            },
        };

        const seeder = new CategorySeederService(em as any);

        const yamlContent = `
categories:
  - code: test_clothing
    name: Test Clothing
    description: Test clothing category
    phrases:
      - test shirt
      - test pants
    base_questions:
      - code: quantity
        prompt: How many?
        answer_type: NUMBER
        is_required: true
        sort_order: 1
    sites:
      - role: FACTORY_CONTACT
        name: Test Site
        priority: 100
        requires_login: false
        query_template: '{товар}'
        exclude_note: null
`;

        await seeder.seedFromString(yamlContent);

        const initialCategoryCount = categories.length;
        const initialPhraseCount = phrases.length;
        const initialQuestionCount = questions.length;
        const initialSiteCount = sites.length;

        expect(initialCategoryCount).toBe(1);
        expect(initialPhraseCount).toBe(2);
        expect(initialQuestionCount).toBe(1);
        expect(initialSiteCount).toBe(1);

        const adminCategory = new CategoryEntity();

        adminCategory.id = 'admin-cat';
        adminCategory.code = null;
        adminCategory.name = 'Admin Created Category';
        adminCategory.description = 'Created by admin, has no code';
        adminCategory.status = CategoryStatus.ACTIVE;
        categories.push(adminCategory);

        expect(categories.length).toBe(2);

        await seeder.seedFromString(yamlContent);

        expect(categories.length).toBe(2);
        expect(phrases.length).toBe(initialPhraseCount);
        expect(questions.length).toBe(initialQuestionCount);
        expect(sites.length).toBe(initialSiteCount);

        const adminCategoryStillThere = categories.find((c) => c.code === null);

        expect(adminCategoryStillThere).toBeDefined();
        expect(adminCategoryStillThere?.name).toBe('Admin Created Category');

        const yamlUpdated = `
categories:
  - code: test_clothing
    name: Test Clothing Updated
    description: Updated description
    phrases:
      - test shirt
      - test pants
      - test jacket
    base_questions:
      - code: quantity
        prompt: How many items?
        answer_type: NUMBER
        is_required: true
        sort_order: 1
    sites:
      - role: FACTORY_CONTACT
        name: Test Site
        priority: 100
        requires_login: false
        query_template: '{товар}'
        exclude_note: null
`;

        await seeder.seedFromString(yamlUpdated);

        expect(categories.length).toBe(2);

        const updatedCategory = categories.find((c) => c.code === 'test_clothing');

        expect(updatedCategory?.name).toBe('Test Clothing Updated');
        expect(updatedCategory?.description).toBe('Updated description');

        expect(phrases.length).toBe(3);

        const updatedQuestion = questions.find((q) => q.code === 'quantity');

        expect(updatedQuestion?.prompt).toBe('How many items?');
    });
});
