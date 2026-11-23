import { PositiveNumber } from '../../domain/value-objects';
import { ListQuery } from './list-query';

/**
 * Нормализует параметры пагинации для list-запросов.
 */
export function normalizePagination(query: ListQuery): {
    page: number;
    limit: number;
    offset: number;
} {
    const rawPage = query.page ?? 1;
    const rawLimit = query.limit ?? 20;

    const pageVo = PositiveNumber.create(rawPage, 'page');
    const limitVo = PositiveNumber.create(rawLimit, 'limit');

    const page = pageVo.getValue();
    const limit = limitVo.getValue();
    const offset = (page - 1) * limit;

    return { page, limit, offset };
}
