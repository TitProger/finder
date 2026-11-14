import type { PageInfo } from './api-response.interface';

/**
 * Результат HTTP-сервиса до обёртки интерсептором в контрактный ApiResponse.
 */
export interface ServiceResult<TData = unknown, TCount = unknown> {
    data: TData;
    message?: string;
    page?: PageInfo;
    count?: TCount;
}
