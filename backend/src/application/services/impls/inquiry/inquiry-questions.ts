import { normalizePhrase } from '../../../../domain/text/phrase-text';

export type PackSample = {
    id: string;
    code: string;
    title: string;
    isActive: boolean;
};

export type AskedQuestionSample = {
    id: string;
    sortOrder: number;
    questionPackId: string | null;
};

/**
 * Пакет внутри уже выбранной категории.
 * Точное совпадение текста с code или title одного активного пакета.
 * Ноль или несколько совпадений — пакет не выбран, пауза из-за пакетов не ставится.
 * Вектор описания пакета на этом этапе не назначает: порог модели не выбран.
 */
export function selectQuestionPack(text: string, packs: readonly PackSample[]): string | null {
    const normalized = normalizePhrase(text);

    if (!normalized) {
        return null;
    }

    const hits = packs.filter((pack) => {
        if (!pack.isActive) {
            return false;
        }

        return normalizePhrase(pack.title) === normalized || normalizePhrase(pack.code) === normalized;
    });

    if (hits.length !== 1) {
        return null;
    }

    return hits[0].id;
}

/** Базовый вопрос (без пакета) или вопрос ровно выбранного пакета. */
export function isQuestionAsked(questionPackId: string | null, selectedPackId: string | null): boolean {
    if (questionPackId === null) {
        return true;
    }

    return selectedPackId !== null && questionPackId === selectedPackId;
}

/** Сначала база категории, внутри группы — sortOrder, затем id. */
export function compareAskedQuestions(left: AskedQuestionSample, right: AskedQuestionSample): number {
    const leftGroup = left.questionPackId === null ? 0 : 1;
    const rightGroup = right.questionPackId === null ? 0 : 1;

    if (leftGroup !== rightGroup) {
        return leftGroup - rightGroup;
    }

    if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
    }

    if (left.id < right.id) {
        return -1;
    }

    if (left.id > right.id) {
        return 1;
    }

    return 0;
}
