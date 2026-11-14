import { PositiveNumber, NonNegativeNumber } from '../../../domain/value-objects';
import {
    InvalidPaginationParamException,
    PaginationPageOutOfRangeException,
} from '../../../common/exceptions/pagination.exception';
import type { ApiError, ApiResponse, ApiResponseOptions, ApiStatus, PageInfo } from './api-response.interface';
import { ApiStatuses } from './api-response.interface';

export * from './api-response.interface';

const DEV_ENVS = ['development', 'dev', 'debug'];

/**
 * Собирает единый envelope {@link ApiResponse} по контракту.
 */
export function createApiResponse<TData = unknown, TCount = unknown>(
    status: ApiStatus,
    data: TData | null,
    message = 'OK',
    options: ApiResponseOptions<TCount> = {},
): ApiResponse<TData, TCount> {
    const base: ApiResponse<TData, TCount> = {
        status,
        data,
        message,
    };

    if (options.page) {
        base.page = processPagination(options.page);
    }

    if (options.count !== undefined) {
        base.count = options.count;
    }

    if (options.requestId) {
        base.requestId = options.requestId;
    }

    if (status === ApiStatuses.Error) {
        base.error = normalizeError(options.error ?? new Error(message || 'Error'));
    }

    return base;
}

function isDev(): boolean {
    const env = process.env.NODE_ENV || '';

    return DEV_ENVS.includes(env) || process.env.LOG_LEVEL === 'debug';
}

function normalizeError(source: unknown): ApiError {
    const error = source instanceof Error ? source : new Error(String(source));

    const formatted: ApiError = {
        name: error.name,
        message: error.message,
        code: (error as { code?: string | number }).code,
    };

    if (isDev()) {
        // stack нет в контрактном ApiError — кладём в context
        formatted.context = {
            stack: error.stack,
            details: (error as { context?: unknown }).context,
        };
    }

    return formatted;
}

/**
 * Нормализует page и считает totalPages (поле контракта PageInfo).
 */
function processPagination(pageInfo: PageInfo): PageInfo {
    const pageVo = PositiveNumber.create(pageInfo.page, 'page');
    const limitVo = PositiveNumber.create(pageInfo.limit, 'limit');
    const totalVo = NonNegativeNumber.create(Number(pageInfo.total), 'total');

    const page = pageVo.getValue();
    const limit = limitVo.getValue();
    const total = totalVo.getValue();

    if (limit === 0) {
        throw new InvalidPaginationParamException('Некорректное значение limit: должно быть больше 0', {
            code: 'INVALID_PAGINATION_LIMIT',
        });
    }

    const computedTotalPages = total === 0 ? 0 : Math.ceil(total / limit);

    if (total > 0 && page > computedTotalPages) {
        throw new PaginationPageOutOfRangeException(
            `Запрошенная страница ${page} превышает общее количество страниц ${computedTotalPages}`,
            { code: 'PAGE_OUT_OF_RANGE' },
        );
    }

    return {
        page,
        limit,
        total,
        totalPages: computedTotalPages,
    };
}
