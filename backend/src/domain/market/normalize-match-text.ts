/**
 * Нормализация текста для похожего совпадения кэша досье.
 */
export function normalizeMatchText(value: string | null | undefined): string {
    return (value ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Похожее совпадение: точное равенство нормализованных строк
 * или вхождение более короткой в более длинную при длине ≥ 4.
 */
export function isSimilarMatchText(left: string, right: string): boolean {
    const a = normalizeMatchText(left);
    const b = normalizeMatchText(right);

    if (!a || !b) {
        return false;
    }

    if (a === b) {
        return true;
    }

    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;

    return shorter.length >= 4 && longer.includes(shorter);
}
