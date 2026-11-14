import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';

import {
    CATEGORY_ADMIN_SERVICE,
    CategoryAdminService,
} from '../../../../application/services/contracts/category/category-admin.service';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { SiteRole } from '../../../../domain/enums/site-role.enum';
import type {
    CreateCategoryPhraseRequest,
    CreateCategoryQuestionRequest,
    CreateCategoryRequest,
    CreateCategorySiteRequest,
    CreateQuestionPackRequest,
    UpdateCategoryPhraseRequest,
    UpdateCategoryQuestionRequest,
    UpdateCategoryRequest,
    UpdateCategorySiteRequest,
    UpdateQuestionPackRequest,
} from '../../generated/requests/categories';
import type {
    Category,
    CategoryDetail,
    CategoryPhrase,
    CategoryQuestion,
    CategorySite,
    QuestionPack,
} from '../../generated/responses/categories';
import { CategoryMapper } from '../../mappers/category/category.mapper';

@Controller('admin/categories')
export class CategoryController {
    constructor(
        @Inject(CATEGORY_ADMIN_SERVICE)
        private readonly categoryAdminService: CategoryAdminService,
    ) {}

    @Post()
    async create(@Body() body: CreateCategoryRequest): Promise<Category> {
        const entity = await this.categoryAdminService.createCategory({
            name: body.name,
            description: body.description,
            status: body.status as CategoryStatus | undefined,
        });

        return CategoryMapper.toCategory(entity);
    }

    @Get(':id')
    async getById(@Param('id') id: string): Promise<CategoryDetail> {
        const entity = await this.categoryAdminService.getCategoryById(id);

        return CategoryMapper.toDetail(entity);
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() body: UpdateCategoryRequest): Promise<Category> {
        const entity = await this.categoryAdminService.updateCategory(id, {
            name: body.name,
            description: body.description,
            status: body.status as CategoryStatus | undefined,
        });

        return CategoryMapper.toCategory(entity);
    }

    @Post(':categoryId/phrases')
    async createPhrase(
        @Param('categoryId') categoryId: string,
        @Body() body: CreateCategoryPhraseRequest,
    ): Promise<CategoryPhrase> {
        const entity = await this.categoryAdminService.createPhrase(categoryId, body);

        return CategoryMapper.toPhrase(entity);
    }

    @Patch(':categoryId/phrases/:id')
    async updatePhrase(
        @Param('categoryId') categoryId: string,
        @Param('id') id: string,
        @Body() body: UpdateCategoryPhraseRequest,
    ): Promise<CategoryPhrase> {
        const entity = await this.categoryAdminService.updatePhrase(categoryId, id, body);

        return CategoryMapper.toPhrase(entity);
    }

    @Post(':categoryId/question-packs')
    async createPack(
        @Param('categoryId') categoryId: string,
        @Body() body: CreateQuestionPackRequest,
    ): Promise<QuestionPack> {
        const entity = await this.categoryAdminService.createQuestionPack(categoryId, {
            code: body.code,
            title: body.title,
            description: body.description,
            sortOrder: body.sortOrder,
            isActive: body.isActive,
        });

        return CategoryMapper.toPack(entity);
    }

    @Patch(':categoryId/question-packs/:id')
    async updatePack(
        @Param('categoryId') categoryId: string,
        @Param('id') id: string,
        @Body() body: UpdateQuestionPackRequest,
    ): Promise<QuestionPack> {
        const entity = await this.categoryAdminService.updateQuestionPack(categoryId, id, {
            code: body.code,
            title: body.title,
            description: body.description,
            sortOrder: body.sortOrder,
            isActive: body.isActive,
        });

        return CategoryMapper.toPack(entity);
    }

    @Post(':categoryId/questions')
    async createQuestion(
        @Param('categoryId') categoryId: string,
        @Body() body: CreateCategoryQuestionRequest,
    ): Promise<CategoryQuestion> {
        const entity = await this.categoryAdminService.createQuestion(categoryId, {
            questionPackId: body.questionPackId,
            prompt: body.prompt,
            answerType: body.answerType as QuestionAnswerType,
            choices: body.choices,
            isRequired: body.isRequired,
            sortOrder: body.sortOrder,
        });

        return CategoryMapper.toQuestion(entity);
    }

    @Patch(':categoryId/questions/:id')
    async updateQuestion(
        @Param('categoryId') categoryId: string,
        @Param('id') id: string,
        @Body() body: UpdateCategoryQuestionRequest,
    ): Promise<CategoryQuestion> {
        const entity = await this.categoryAdminService.updateQuestion(categoryId, id, {
            questionPackId: body.questionPackId,
            prompt: body.prompt,
            answerType: body.answerType as QuestionAnswerType | undefined,
            choices: body.choices,
            isRequired: body.isRequired,
            sortOrder: body.sortOrder,
        });

        return CategoryMapper.toQuestion(entity);
    }

    @Post(':categoryId/sites')
    async createSite(
        @Param('categoryId') categoryId: string,
        @Body() body: CreateCategorySiteRequest,
    ): Promise<CategorySite> {
        const entity = await this.categoryAdminService.createSite(categoryId, {
            siteRole: body.siteRole as SiteRole,
            name: body.name,
            baseUrl: body.baseUrl,
            priority: body.priority,
            requiresLogin: body.requiresLogin,
            queryTemplate: body.queryTemplate,
            excludeNote: body.excludeNote,
            isActive: body.isActive,
        });

        return CategoryMapper.toSite(entity);
    }

    @Patch(':categoryId/sites/:id')
    async updateSite(
        @Param('categoryId') categoryId: string,
        @Param('id') id: string,
        @Body() body: UpdateCategorySiteRequest,
    ): Promise<CategorySite> {
        const entity = await this.categoryAdminService.updateSite(categoryId, id, {
            siteRole: body.siteRole as SiteRole | undefined,
            name: body.name,
            baseUrl: body.baseUrl,
            priority: body.priority,
            requiresLogin: body.requiresLogin,
            queryTemplate: body.queryTemplate,
            excludeNote: body.excludeNote,
            isActive: body.isActive,
        });

        return CategoryMapper.toSite(entity);
    }
}
