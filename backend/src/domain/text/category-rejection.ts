import { normalizePhrase } from './phrase-text';

const REJECTION = 'это не та категория';

/** Клиент отказывается от назначенной категории. Регистр и точка на конце не важны. */
export function isCategoryRejection(text: string): boolean {
    const normalized = normalizePhrase(text)
        .replace(/[.!?…]+$/u, '')
        .trim();

    return normalized === REJECTION;
}
