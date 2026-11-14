import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import {
    CategoryAdminService,
    CreateCategoryInput,
    CreateCategoryPhraseInput,
    CreateCategoryQuestionInput,
    CreateCategorySiteInput,
    CreateQuestionPackInput,
    UpdateCategoryInput,
    UpdateCategoryPhraseInput,
    UpdateCategoryQuestionInput,
    UpdateCategorySiteInput,
    UpdateQuestionPackInput,
} from '../../contracts/category/category-admin.service';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../../../domain/entities/category/category-site.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { CategoryPhraseRepository } from '../../../../domain/repositories/category/category-phrase.repository';
import { CategoryQuestionRepository } from '../../../../domain/repositories/category/category-question.repository';
import { CategorySiteRepository } from '../../../../domain/repositories/category/category-site.repository';
import { QuestionPackRepository } from '../../../../domain/repositories/category/question-pack.repository';

const CATEGORY_DETAIL_POPULATE = ['phrases', 'questionPacks', 'questions', 'sites'] as const;

@Injectable()
export class CategoryAdminServiceImpl implements CategoryAdminService {
    constructor(
        @Inject(REPOSITORY_TOKENS.CATEGORY_REPOSITORY)
        private readonly categories: CategoryRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_PHRASE_REPOSITORY)
        private readonly phrases: CategoryPhraseRepository,
        @Inject(REPOSITORY_TOKENS.QUESTION_PACK_REPOSITORY)
        private readonly packs: QuestionPackRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_QUESTION_REPOSITORY)
        private readonly questions: CategoryQuestionRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_SITE_REPOSITORY)
        private readonly sites: CategorySiteRepository,
    ) {}

    async listActive(): Promise<CategoryEntity[]> {
        const rows = await this.categories.find({ status: CategoryStatus.ACTIVE });

        return [...rows].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    }

    async createCategory(input: CreateCategoryInput): Promise<CategoryEntity> {
        const entity = this.categories.create({
            name: input.name,
            description: input.description,
            status: input.status ?? CategoryStatus.ACTIVE,
        });

        try {
            await this.categories.getEntityManager().persistAndFlush(entity);
        } catch (error) {
            this.rethrowConflict(error, AppErrors.category.nameConflict);
        }

        return entity;
    }

    async getCategoryById(id: string): Promise<CategoryEntity> {
        const entity = await this.categories.findOne({ id }, { populate: [...CATEGORY_DETAIL_POPULATE] });

        if (!entity) {
            throw new NotFoundAppException(AppErrors.category.notFound.message, {
                code: AppErrors.category.notFound.code,
            });
        }

        return entity;
    }

    async updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryEntity> {
        const entity = await this.requireCategory(id);

        if (input.name !== undefined) {
            entity.name = input.name;
        }

        if (input.description !== undefined) {
            entity.description = input.description;
        }

        if (input.status !== undefined) {
            entity.status = input.status;
        }

        try {
            await this.categories.getEntityManager().flush();
        } catch (error) {
            this.rethrowConflict(error, AppErrors.category.nameConflict);
        }

        return entity;
    }

    async createPhrase(categoryId: string, input: CreateCategoryPhraseInput): Promise<CategoryPhraseEntity> {
        const category = await this.requireCategory(categoryId);
        const entity = this.phrases.create({ category, phrase: input.phrase });

        try {
            await this.phrases.getEntityManager().persistAndFlush(entity);
        } catch (error) {
            this.rethrowConflict(error, AppErrors.category.phraseConflict);
        }

        return entity;
    }

    async updatePhrase(
        categoryId: string,
        id: string,
        input: UpdateCategoryPhraseInput,
    ): Promise<CategoryPhraseEntity> {
        const entity = await this.phrases.findOne({ id, category: categoryId });

        if (!entity) {
            throw new NotFoundAppException(AppErrors.category.phraseNotFound.message, {
                code: AppErrors.category.phraseNotFound.code,
            });
        }

        if (input.phrase !== undefined) {
            entity.phrase = input.phrase;
        }

        try {
            await this.phrases.getEntityManager().flush();
        } catch (error) {
            this.rethrowConflict(error, AppErrors.category.phraseConflict);
        }

        return entity;
    }

    async createQuestionPack(categoryId: string, input: CreateQuestionPackInput): Promise<QuestionPackEntity> {
        const category = await this.requireCategory(categoryId);
        const entity = this.packs.create({
            category,
            code: input.code,
            title: input.title,
            description: input.description ?? null,
            sortOrder: input.sortOrder ?? 0,
            isActive: input.isActive ?? true,
        });

        try {
            await this.packs.getEntityManager().persistAndFlush(entity);
        } catch (error) {
            this.rethrowConflict(error, AppErrors.category.packCodeConflict);
        }

        return entity;
    }

    async updateQuestionPack(
        categoryId: string,
        id: string,
        input: UpdateQuestionPackInput,
    ): Promise<QuestionPackEntity> {
        const entity = await this.packs.findOne({ id, category: categoryId });

        if (!entity) {
            throw new NotFoundAppException(AppErrors.category.packNotFound.message, {
                code: AppErrors.category.packNotFound.code,
            });
        }

        if (input.code !== undefined) {
            entity.code = input.code;
        }

        if (input.title !== undefined) {
            entity.title = input.title;
        }

        if (input.description !== undefined) {
            entity.description = input.description;
        }

        if (input.sortOrder !== undefined) {
            entity.sortOrder = input.sortOrder;
        }

        if (input.isActive !== undefined) {
            entity.isActive = input.isActive;
        }

        try {
            await this.packs.getEntityManager().flush();
        } catch (error) {
            this.rethrowConflict(error, AppErrors.category.packCodeConflict);
        }

        return entity;
    }

    async createQuestion(categoryId: string, input: CreateCategoryQuestionInput): Promise<CategoryQuestionEntity> {
        const category = await this.requireCategory(categoryId);
        let questionPack: QuestionPackEntity | null = null;

        if (input.questionPackId) {
            questionPack = await this.packs.findOne({ id: input.questionPackId, category: categoryId });

            if (!questionPack) {
                throw new NotFoundAppException(AppErrors.category.packNotFound.message, {
                    code: AppErrors.category.packNotFound.code,
                });
            }
        }

        const entity = this.questions.create({
            category,
            questionPack,
            prompt: input.prompt,
            answerType: input.answerType,
            choices: input.choices ?? null,
            isRequired: input.isRequired ?? true,
            sortOrder: input.sortOrder ?? 0,
        });

        await this.questions.getEntityManager().persistAndFlush(entity);

        return entity;
    }

    async updateQuestion(
        categoryId: string,
        id: string,
        input: UpdateCategoryQuestionInput,
    ): Promise<CategoryQuestionEntity> {
        const entity = await this.questions.findOne({ id, category: categoryId });

        if (!entity) {
            throw new NotFoundAppException(AppErrors.category.questionNotFound.message, {
                code: AppErrors.category.questionNotFound.code,
            });
        }

        if (input.questionPackId !== undefined) {
            if (input.questionPackId === null) {
                entity.questionPack = null;
            } else {
                const pack = await this.packs.findOne({ id: input.questionPackId, category: categoryId });

                if (!pack) {
                    throw new NotFoundAppException(AppErrors.category.packNotFound.message, {
                        code: AppErrors.category.packNotFound.code,
                    });
                }

                entity.questionPack = pack;
            }
        }

        if (input.prompt !== undefined) {
            entity.prompt = input.prompt;
        }

        if (input.answerType !== undefined) {
            entity.answerType = input.answerType;
        }

        if (input.choices !== undefined) {
            entity.choices = input.choices;
        }

        if (input.isRequired !== undefined) {
            entity.isRequired = input.isRequired;
        }

        if (input.sortOrder !== undefined) {
            entity.sortOrder = input.sortOrder;
        }

        await this.questions.getEntityManager().flush();

        return entity;
    }

    async createSite(categoryId: string, input: CreateCategorySiteInput): Promise<CategorySiteEntity> {
        const category = await this.requireCategory(categoryId);
        const entity = this.sites.create({
            category,
            siteRole: input.siteRole,
            name: input.name,
            baseUrl: input.baseUrl ?? null,
            priority: input.priority ?? 100,
            requiresLogin: input.requiresLogin ?? false,
            queryTemplate: input.queryTemplate ?? null,
            excludeNote: input.excludeNote ?? null,
            isActive: input.isActive ?? true,
        });

        await this.sites.getEntityManager().persistAndFlush(entity);

        return entity;
    }

    async updateSite(categoryId: string, id: string, input: UpdateCategorySiteInput): Promise<CategorySiteEntity> {
        const entity = await this.sites.findOne({ id, category: categoryId });

        if (!entity) {
            throw new NotFoundAppException(AppErrors.category.siteNotFound.message, {
                code: AppErrors.category.siteNotFound.code,
            });
        }

        if (input.siteRole !== undefined) {
            entity.siteRole = input.siteRole;
        }

        if (input.name !== undefined) {
            entity.name = input.name;
        }

        if (input.baseUrl !== undefined) {
            entity.baseUrl = input.baseUrl;
        }

        if (input.priority !== undefined) {
            entity.priority = input.priority;
        }

        if (input.requiresLogin !== undefined) {
            entity.requiresLogin = input.requiresLogin;
        }

        if (input.queryTemplate !== undefined) {
            entity.queryTemplate = input.queryTemplate;
        }

        if (input.excludeNote !== undefined) {
            entity.excludeNote = input.excludeNote;
        }

        if (input.isActive !== undefined) {
            entity.isActive = input.isActive;
        }

        await this.sites.getEntityManager().flush();

        return entity;
    }

    private async requireCategory(id: string): Promise<CategoryEntity> {
        const entity = await this.categories.findOne({ id });

        if (!entity) {
            throw new NotFoundAppException(AppErrors.category.notFound.message, {
                code: AppErrors.category.notFound.code,
            });
        }

        return entity;
    }

    private rethrowConflict(error: unknown, appError: { code: string; message: string }): never {
        if (error instanceof UniqueConstraintViolationException) {
            throw new ConflictAppException(appError.message, { code: appError.code });
        }

        throw error;
    }
}
