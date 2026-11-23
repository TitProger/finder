/**
 * Базовый query для list (поля из OpenAPI: page/limit/sort).
 * Валидация входа — AJV по контракту, не class-validator.
 */
export type ListQuery = {
    page?: number;
    limit?: number;
    /** JSON-строка, например `{"title":"asc"}` */
    sort?: string;
};

export type ListResult<TEntity> = {
    items: TEntity[];
    page: number;
    limit: number;
    total: number;
};
