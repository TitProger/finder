/**
 * Простая нормализация русского текста для сопоставления ключевых слов.
 * Приводит к нижнему регистру и упрощает словоформы.
 */

const WORD_FORM_ENDINGS = [
    'ами',
    'ями',
    'ах',
    'ях',
    'ов',
    'ев',
    'ий',
    'ый',
    'ая',
    'ое',
    'ые',
    'ой',
    'ей',
    'ом',
    'ем',
    'ы',
    'и',
    'а',
    'я',
    'у',
    'ю',
    'е',
];

export function normalizeRussianText(text: string): string {
    return text.toLowerCase().trim();
}

export function normalizeRussianWord(word: string): string {
    const normalized = word.toLowerCase().trim();

    for (const ending of WORD_FORM_ENDINGS) {
        if (normalized.endsWith(ending) && normalized.length > ending.length + 2) {
            return normalized.slice(0, -ending.length);
        }
    }

    return normalized;
}

export function extractWords(text: string): string[] {
    return text
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 0);
}

export function containsKeywords(text: string, keywords: string[]): boolean {
    const normalizedText = normalizeRussianText(text);
    const words = extractWords(normalizedText).map(normalizeRussianWord);

    for (const keyword of keywords) {
        const normalizedKeyword = normalizeRussianWord(keyword.toLowerCase());

        const found = words.some((word) => {
            return word.includes(normalizedKeyword) || normalizedKeyword.includes(word);
        });

        if (!found) {
            const directMatch = normalizedText.includes(normalizedKeyword);

            if (directMatch) {
                return true;
            }

            return false;
        }
    }

    return keywords.length > 0;
}
