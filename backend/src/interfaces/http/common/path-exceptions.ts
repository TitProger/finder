/**
 * Пути, которые не валидируем по OpenAPI (статика Swagger / metrics).
 * Операции из контракта (`/health`) сюда не кладём —
 * их схемы как раз должны проверяться AJV.
 */
export const OPENAPI_SKIP_PREFIXES = ['/docs', '/documentation', '/swagger', '/metrics'] as const;

export function pathMatchesPrefix(path: string, prefixes: readonly string[]): boolean {
    const normalized = path.split('?')[0] || path;

    return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}
