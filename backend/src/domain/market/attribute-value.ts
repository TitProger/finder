import { QuestionAnswerType } from '../enums/question-answer-type.enum';

/** Значение обязательного ответа в полях карточки. */
export type AttributeValue = string | number | boolean | string[];

/**
 * Канонический вид ответа для буквального сравнения.
 * Число сравнивается как число, текст — после обрезки пробелов, регистр сохраняется.
 */
export function canonicalAttributeValue(answerType: QuestionAnswerType, value: unknown): string | null {
    if (answerType === QuestionAnswerType.NUMBER) {
        const numeric =
            typeof value === 'number'
                ? value
                : typeof value === 'string'
                  ? Number(value.replace(',', '.'))
                  : Number.NaN;

        if (!Number.isFinite(numeric)) {
            return null;
        }

        return `n:${numeric}`;
    }

    if (answerType === QuestionAnswerType.BOOLEAN) {
        if (value === true) {
            return 'b:да';
        }

        if (value === false) {
            return 'b:нет';
        }

        if (typeof value !== 'string') {
            return null;
        }

        const token = value.trim().toLocaleLowerCase('ru');

        if (token === 'да' || token === 'true' || token === 'yes' || token === '1') {
            return 'b:да';
        }

        if (token === 'нет' || token === 'false' || token === 'no' || token === '0') {
            return 'b:нет';
        }

        return null;
    }

    if (answerType === QuestionAnswerType.MULTI_CHOICE) {
        const list = readList(value);

        if (!list) {
            return null;
        }

        return `m:${[...list].sort((left, right) => left.localeCompare(right, 'ru')).join('\u0001')}`;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const text = value.trim().replace(/\s+/g, ' ');

    if (!text) {
        return null;
    }

    return `t:${text}`;
}

/** Ответ заявки в тот же канонический вид, что и поле карточки. */
export function canonicalStoredAnswer(
    answerType: QuestionAnswerType,
    valueText: string | null | undefined,
    valueJson: unknown,
): string | null {
    if (answerType === QuestionAnswerType.MULTI_CHOICE) {
        return canonicalAttributeValue(answerType, valueJson ?? valueText);
    }

    return canonicalAttributeValue(answerType, valueText);
}

function readList(value: unknown): string[] | null {
    if (Array.isArray(value)) {
        const list = value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0);

        return list.length > 0 ? list : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const list = value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    return list.length > 0 ? list : null;
}
