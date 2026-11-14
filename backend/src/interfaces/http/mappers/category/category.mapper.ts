import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../../domain/entities/category/category-phrase.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../../../domain/entities/category/category-site.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import type {
    Category,
    CategoryDetail,
    CategoryPhrase,
    CategoryQuestion,
    CategorySite,
    QuestionPack,
} from '../../generated/responses/categories';

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

export class CategoryMapper {
    static toCategory(entity: CategoryEntity): Category {
        return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            status: entity.status,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }

    static toDetail(entity: CategoryEntity): CategoryDetail {
        return {
            ...this.toCategory(entity),
            phrases: entity.phrases.getItems().map((item) => this.toPhrase(item)),
            questionPacks: entity.questionPacks.getItems().map((item) => this.toPack(item)),
            questions: entity.questions.getItems().map((item) => this.toQuestion(item)),
            sites: entity.sites.getItems().map((item) => this.toSite(item)),
        };
    }

    static toPhrase(entity: CategoryPhraseEntity): CategoryPhrase {
        return {
            id: entity.id,
            categoryId: entity.category.id,
            phrase: entity.phrase,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }

    static toPack(entity: QuestionPackEntity): QuestionPack {
        return {
            id: entity.id,
            categoryId: entity.category.id,
            code: entity.code,
            title: entity.title,
            description: entity.description ?? null,
            sortOrder: entity.sortOrder,
            isActive: entity.isActive,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }

    static toQuestion(entity: CategoryQuestionEntity): CategoryQuestion {
        return {
            id: entity.id,
            categoryId: entity.category.id,
            questionPackId: entity.questionPack?.id ?? null,
            prompt: entity.prompt,
            answerType: entity.answerType,
            choices: (entity.choices as CategoryQuestion['choices']) ?? null,
            isRequired: entity.isRequired,
            sortOrder: entity.sortOrder,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }

    static toSite(entity: CategorySiteEntity): CategorySite {
        return {
            id: entity.id,
            categoryId: entity.category.id,
            siteRole: entity.siteRole,
            name: entity.name,
            baseUrl: entity.baseUrl ?? null,
            priority: entity.priority,
            requiresLogin: entity.requiresLogin,
            queryTemplate: entity.queryTemplate ?? null,
            excludeNote: entity.excludeNote ?? null,
            isActive: entity.isActive,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }
}
