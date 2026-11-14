import type {
    ApiError as ContractApiError,
    ApiResponse as ContractApiResponse,
    ApiStatus as ContractApiStatus,
    PageInfo as ContractPageInfo,
} from '../generated/common';

/** Типы envelope из api-contract (generated). */
export type ApiError = ContractApiError;
export type PageInfo = ContractPageInfo;
export type ApiStatus = ContractApiStatus;

/**
 * Runtime-константы статуса.
 * В контракте `ApiStatus` — string union, не enum.
 */
export const ApiStatuses = {
    Success: 'success',
    Error: 'error',
} as const satisfies Record<string, ApiStatus>;

/**
 * Типизированная обёртка поверх контрактного {@link ContractApiResponse}.
 * `data` / `count` в OpenAPI — unknown; здесь сужаем под конкретный эндпоинт.
 */
export type ApiResponse<TData = unknown, TCount = unknown> = Omit<ContractApiResponse, 'data' | 'count' | 'status'> & {
    status: ApiStatus;
    data: TData | null;
    count?: TCount;
};

/** Опции сборки ответа в {@link createApiResponse}. */
export type ApiResponseOptions<TCount = unknown> = {
    page?: PageInfo;
    count?: TCount;
    requestId?: string;
    error?: unknown;
};
