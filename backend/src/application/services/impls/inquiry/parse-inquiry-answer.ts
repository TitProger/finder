import { AppErrors } from '../../../errors';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { displayPhrase, normalizePhrase } from '../../../../domain/text/phrase-text';

export type ParsedInquiryAnswer = {
    valueText: string | null;
    valueJson: unknown;
};

const YES = new Set(['да', 'yes', 'true', '1']);
const NO = new Set(['нет', 'no', 'false', '0']);

/** Текст вопроса для клиента: формулировка и варианты, если они есть. */
export function formatAskedPrompt(prompt: string, choices: unknown): string {
    const labels = choiceLabels(choices);

    if (!labels) {
        return prompt;
    }

    return `${prompt}\n${labels.map((label) => `• ${label}`).join('\n')}`;
}

/** Проверяет ответ по типу вопроса. Цену не считает. */
export function parseInquiryAnswer(answerType: QuestionAnswerType, choices: unknown, raw: string): ParsedInquiryAnswer {
    const display = displayPhrase(raw);

    if (!normalizePhrase(display)) {
        throw new BadRequestAppException(AppErrors.inquiry.answerEmpty.message, {
            code: AppErrors.inquiry.answerEmpty.code,
        });
    }

    if (answerType === QuestionAnswerType.NUMBER) {
        const parsed = Number(display.replace(',', '.'));

        if (!Number.isFinite(parsed)) {
            throw new BadRequestAppException(AppErrors.inquiry.answerNumber.message, {
                code: AppErrors.inquiry.answerNumber.code,
            });
        }

        return { valueText: String(parsed), valueJson: null };
    }

    if (answerType === QuestionAnswerType.BOOLEAN) {
        const token = normalizePhrase(display);

        if (!YES.has(token) && !NO.has(token)) {
            throw new BadRequestAppException(AppErrors.inquiry.answerBoolean.message, {
                code: AppErrors.inquiry.answerBoolean.code,
            });
        }

        return { valueText: YES.has(token) ? 'да' : 'нет', valueJson: null };
    }

    if (answerType === QuestionAnswerType.SINGLE_CHOICE || answerType === QuestionAnswerType.MULTI_CHOICE) {
        const labels = choiceLabels(choices);

        if (!labels) {
            return { valueText: display, valueJson: null };
        }

        if (answerType === QuestionAnswerType.SINGLE_CHOICE) {
            const matched = labels.find((label) => normalizePhrase(label) === normalizePhrase(display));

            if (!matched) {
                throw new BadRequestAppException(AppErrors.inquiry.answerChoice.message, {
                    code: AppErrors.inquiry.answerChoice.code,
                });
            }

            return { valueText: matched, valueJson: null };
        }

        const parts = display
            .split(',')
            .map((part) => part.trim())
            .filter((part) => normalizePhrase(part));
        const matched = parts.map((part) => labels.find((label) => normalizePhrase(label) === normalizePhrase(part)));

        if (parts.length === 0 || matched.some((item) => !item)) {
            throw new BadRequestAppException(AppErrors.inquiry.answerChoice.message, {
                code: AppErrors.inquiry.answerChoice.code,
            });
        }

        const values = matched.filter((item): item is string => Boolean(item));

        return { valueText: values.join(', '), valueJson: values };
    }

    return { valueText: display, valueJson: null };
}

function choiceLabels(choices: unknown): string[] | null {
    if (Array.isArray(choices)) {
        const labels = choices.map(labelOf).filter((label) => label.length > 0);

        return labels.length > 0 ? labels : null;
    }

    if (choices && typeof choices === 'object') {
        const record = choices as Record<string, unknown>;

        if (Array.isArray(record.options)) {
            return choiceLabels(record.options);
        }

        if (Array.isArray(record.choices)) {
            return choiceLabels(record.choices);
        }
    }

    return null;
}

function labelOf(item: unknown): string {
    if (typeof item === 'string') {
        return item.trim();
    }

    if (item && typeof item === 'object' && 'label' in item && typeof item.label === 'string') {
        return item.label.trim();
    }

    return '';
}
