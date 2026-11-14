import { EconomicsInput } from './layer-prices';

const KEYS = {
    доставка: 'deliveryPerUnit',
    пошлина: 'dutyPercent',
    наценка: 'markupPercent',
    прочее: 'otherCost',
} as const;

type KeyName = keyof typeof KEYS;

const REQUIRED: KeyName[] = ['доставка', 'пошлина', 'наценка'];
const PERCENT: KeyName[] = ['пошлина', 'наценка'];

export type EconomicsParse = { ok: true; value: EconomicsInput } | { ok: false; message: string };

/**
 * Строка менеджера: `доставка=30 пошлина=10 наценка=25`.
 * `прочее` необязательно. Чужой ключ и нечисло не сохраняются.
 */
export function parseEconomicsLine(text: string): EconomicsParse {
    const normalized = text.trim().replace(/\s*=\s*/g, '=');

    if (!normalized) {
        return { ok: false, message: 'Нужна строка: доставка=30 пошлина=10 наценка=25' };
    }

    const parts = normalized.split(/\s+/);
    const values = new Map<KeyName, number>();

    for (const part of parts) {
        const match = /^([a-zа-яё]+)=(\S+)$/i.exec(part);
        const key = match?.[1]?.toLowerCase();

        if (!match || !key || !isKey(key)) {
            return {
                ok: false,
                message: `Не понял «${part}». Ключи: доставка, пошлина, наценка, прочее.`,
            };
        }

        if (values.has(key)) {
            return { ok: false, message: `«${key}» указано дважды.` };
        }

        const parsed = Number(match[2].replace(',', '.'));

        if (!Number.isFinite(parsed) || parsed < 0) {
            return { ok: false, message: `«${key}» должно быть числом не меньше нуля.` };
        }

        if (PERCENT.includes(key) && parsed > 1000) {
            return { ok: false, message: `«${key}» больше 1000 процентов.` };
        }

        values.set(key, parsed);
    }

    const missing = REQUIRED.filter((key) => !values.has(key));

    if (missing.length > 0) {
        return { ok: false, message: `Не хватает: ${missing.join(', ')}.` };
    }

    return {
        ok: true,
        value: {
            deliveryPerUnit: values.get('доставка') ?? 0,
            dutyPercent: values.get('пошлина') ?? 0,
            markupPercent: values.get('наценка') ?? 0,
            otherCost: values.get('прочее') ?? 0,
        },
    };
}

export function validateEconomicsInput(input: EconomicsInput): string | null {
    const fields: [keyof EconomicsInput, string][] = [
        ['deliveryPerUnit', 'доставка'],
        ['dutyPercent', 'пошлина'],
        ['otherCost', 'прочее'],
        ['markupPercent', 'наценка'],
    ];

    for (const [field, label] of fields) {
        const value = input[field];

        if (!Number.isFinite(value) || value < 0) {
            return `«${label}» должно быть числом не меньше нуля.`;
        }
    }

    if (input.dutyPercent > 1000 || input.markupPercent > 1000) {
        return 'Процент больше 1000.';
    }

    return null;
}

function isKey(value: string): value is KeyName {
    return value in KEYS;
}
