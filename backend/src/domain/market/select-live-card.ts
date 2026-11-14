import { QuestionAnswerType } from '../enums/question-answer-type.enum';
import { canonicalAttributeValue, canonicalStoredAnswer } from './attribute-value';
import { decimalSpan } from './decimal-qty';

export type LiveCardAnswer = {
    questionId: string;
    answerType: QuestionAnswerType;
    isRequired: boolean;
    valueText: string | null;
    valueJson: unknown;
};

export type LiveCardCandidate = {
    id: string;
    quantityQuestionId: string;
    qtyMin: string;
    qtyMax: string;
    productAttributes: unknown;
    expiresAt: Date | null;
    markedLiveAt: Date | null;
    isLive: boolean;
};

/**
 * Живая карточка той же категории.
 * Объём — число вопроса quantityQuestionId внутри диапазона.
 * Остальные обязательные ответы совпадают с productAttributes по id вопроса.
 * Несколько подходящих: более узкий диапазон, при равенстве — позже помеченная.
 * Просроченная и неживая не берётся. research_run отсюда не создаётся.
 */
export function selectLiveCard(
    answers: readonly LiveCardAnswer[],
    cards: readonly LiveCardCandidate[],
    now: Date,
): LiveCardCandidate | null {
    const matched = cards.filter((card) => cardFits(answers, card, now));

    if (matched.length === 0) {
        return null;
    }

    return [...matched].sort(byFit)[0] ?? null;
}

function cardFits(answers: readonly LiveCardAnswer[], card: LiveCardCandidate, now: Date): boolean {
    if (!card.isLive || !card.expiresAt || card.expiresAt.getTime() <= now.getTime()) {
        return false;
    }

    const quantity = answers.find((answer) => answer.questionId === card.quantityQuestionId);

    if (!quantity || !quantity.isRequired || quantity.answerType !== QuestionAnswerType.NUMBER) {
        return false;
    }

    const qty = Number(quantity.valueText);

    if (!Number.isFinite(qty) || qty < Number(card.qtyMin) || qty > Number(card.qtyMax)) {
        return false;
    }

    const requiredOthers = answers.filter(
        (answer) => answer.isRequired && answer.questionId !== card.quantityQuestionId,
    );
    const attributes = readAttributes(card.productAttributes);

    if (!attributes) {
        return false;
    }

    const keys = Object.keys(attributes);

    if (keys.length !== requiredOthers.length) {
        return false;
    }

    return requiredOthers.every((answer) => {
        if (!Object.prototype.hasOwnProperty.call(attributes, answer.questionId)) {
            return false;
        }

        const stored = canonicalStoredAnswer(answer.answerType, answer.valueText, answer.valueJson);
        const expected = canonicalAttributeValue(answer.answerType, attributes[answer.questionId]);

        return stored !== null && stored === expected;
    });
}

function readAttributes(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) {
        return {};
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function byFit(left: LiveCardCandidate, right: LiveCardCandidate): number {
    const span = decimalSpan(left.qtyMin, left.qtyMax) - decimalSpan(right.qtyMin, right.qtyMax);

    if (span !== 0) {
        return span;
    }

    return (right.markedLiveAt?.getTime() ?? 0) - (left.markedLiveAt?.getTime() ?? 0);
}
