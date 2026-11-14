import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { ClassificationScores } from '../../../../domain/inquiry/classification';
import { InquiryView } from '../../../../application/services/contracts/inquiry/inquiry.service';
import type { Inquiry, InquiryQuestion } from '../../generated/responses/inquiries';
import { OptimalCardMapper } from '../market/optimal-card.mapper';

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

export class InquiryMapper {
    static toInquiry(view: InquiryView): Inquiry {
        const { inquiry, questions } = view;
        const telegramUserId = inquiry.clientUser.telegramUserId;

        if (telegramUserId == null) {
            throw new Error('У клиента заявки нет telegram user id');
        }

        return {
            id: inquiry.id,
            clientUserId: inquiry.clientUser.id,
            telegramUserId: Number(telegramUserId),
            status: inquiry.status,
            rawText: inquiry.rawText,
            photoUrls: inquiry.photoUrls,
            categoryId: inquiry.category?.id ?? null,
            questionPackId: inquiry.questionPack?.id ?? null,
            isPaused: inquiry.isPaused,
            pauseReason: inquiry.pauseReason ?? null,
            assignedByUserId: inquiry.assignedByUser?.id ?? null,
            classificationScores: toScores(inquiry.classificationScores),
            questions: questions.map((question) => this.toQuestion(question)),
            optimalCardId: inquiry.optimalCard?.id ?? null,
            optimalCard: inquiry.optimalCard ? OptimalCardMapper.toCard(inquiry.optimalCard) : null,
            createdAt: inquiry.createdAt.toISOString(),
            updatedAt: toIso(inquiry.updatedAt),
        };
    }

    private static toQuestion(entity: CategoryQuestionEntity): InquiryQuestion {
        return {
            id: entity.id,
            categoryId: entity.category.id,
            questionPackId: entity.questionPack?.id ?? null,
            prompt: entity.prompt,
            answerType: entity.answerType,
            choices: (entity.choices ?? null) as InquiryQuestion['choices'],
            isRequired: entity.isRequired,
            sortOrder: entity.sortOrder,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }
}

function toScores(value: ClassificationScores | null | undefined): Inquiry['classificationScores'] {
    if (!value) {
        return null;
    }

    return {
        outcome: value.outcome,
        stub: value.stub,
        candidates: value.candidates.map((candidate) => ({
            categoryId: candidate.categoryId,
            categoryName: candidate.categoryName,
            score: candidate.score,
            matchedBy: candidate.matchedBy,
        })),
    };
}
