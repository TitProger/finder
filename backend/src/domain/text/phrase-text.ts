/** Сравнение фраз: обрезать края, схлопнуть пробелы, без регистра. */
export function normalizePhrase(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}

/** Как хранить фразу клиента: обрезать края и схлопнуть пробелы, регистр оставить. */
export function displayPhrase(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}
