/**
 * Парсит OpenAPI SortQuery (`{"field":"asc|desc"}`) в orderBy для MikroORM.
 */
export function parseSort(
    sort?: string,
    fallback: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' },
): Record<string, 'asc' | 'desc'> {
    if (!sort) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(sort) as Record<string, string>;
        const orderBy: Record<string, 'asc' | 'desc'> = {};

        for (const [key, value] of Object.entries(parsed)) {
            if (value === 'asc' || value === 'desc') {
                orderBy[key] = value;
            }
        }

        return Object.keys(orderBy).length > 0 ? orderBy : fallback;
    } catch {
        return fallback;
    }
}
