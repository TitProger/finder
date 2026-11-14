import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../../../domain/entities/category/category-site.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { SiteRole } from '../../../../domain/enums/site-role.enum';

export type CreateCategoryInput = {
    name: string;
    description: string;
    status?: CategoryStatus;
};

export type UpdateCategoryInput = {
    name?: string;
    description?: string;
    status?: CategoryStatus;
};

export type CreateCategoryPhraseInput = { phrase: string };
export type UpdateCategoryPhraseInput = { phrase?: string };

export type CreateQuestionPackInput = {
    code: string;
    title: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
};

export type UpdateQuestionPackInput = {
    code?: string;
    title?: string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
};

export type CreateCategoryQuestionInput = {
    questionPackId?: string | null;
    prompt: string;
    answerType: QuestionAnswerType;
    choices?: unknown;
    isRequired?: boolean;
    sortOrder?: number;
};

export type UpdateCategoryQuestionInput = {
    questionPackId?: string | null;
    prompt?: string;
    answerType?: QuestionAnswerType;
    choices?: unknown;
    isRequired?: boolean;
    sortOrder?: number;
};

export type CreateCategorySiteInput = {
    siteRole: SiteRole;
    name: string;
    baseUrl?: string | null;
    priority?: number;
    requiresLogin?: boolean;
    queryTemplate?: string | null;
    excludeNote?: string | null;
    isActive?: boolean;
};

export type UpdateCategorySiteInput = {
    siteRole?: SiteRole;
    name?: string;
    baseUrl?: string | null;
    priority?: number;
    requiresLogin?: boolean;
    queryTemplate?: string | null;
    excludeNote?: string | null;
    isActive?: boolean;
};

export interface CategoryAdminService {
    listActive(): Promise<CategoryEntity[]>;
    createCategory(input: CreateCategoryInput): Promise<CategoryEntity>;
    getCategoryById(id: string): Promise<CategoryEntity>;
    updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryEntity>;

    createPhrase(categoryId: string, input: CreateCategoryPhraseInput): Promise<CategoryPhraseEntity>;
    updatePhrase(categoryId: string, id: string, input: UpdateCategoryPhraseInput): Promise<CategoryPhraseEntity>;

    createQuestionPack(categoryId: string, input: CreateQuestionPackInput): Promise<QuestionPackEntity>;
    updateQuestionPack(categoryId: string, id: string, input: UpdateQuestionPackInput): Promise<QuestionPackEntity>;

    createQuestion(categoryId: string, input: CreateCategoryQuestionInput): Promise<CategoryQuestionEntity>;
    updateQuestion(categoryId: string, id: string, input: UpdateCategoryQuestionInput): Promise<CategoryQuestionEntity>;

    createSite(categoryId: string, input: CreateCategorySiteInput): Promise<CategorySiteEntity>;
    updateSite(categoryId: string, id: string, input: UpdateCategorySiteInput): Promise<CategorySiteEntity>;
}

export const CATEGORY_ADMIN_SERVICE = Symbol('CATEGORY_ADMIN_SERVICE');
