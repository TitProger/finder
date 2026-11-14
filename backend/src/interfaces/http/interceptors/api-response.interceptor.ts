import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { createApiResponse, ApiResponse, ApiStatuses } from '../common/api-response';
import { ServiceResult } from '../common/service-result.interface';

type InterceptorPayload<T> = ApiResponse<T> | StreamableFile;

const METRICS_ROUTE = '/metrics';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, InterceptorPayload<T>> {
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<InterceptorPayload<T>> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const requestId = String(request.id);

        // Для /metrics возвращаем сырой payload (Prometheus ожидает text/plain, а не JSON-обёртку)
        if (request.url === METRICS_ROUTE) {
            return next.handle() as unknown as Observable<ApiResponse<T>>;
        }

        return next.handle().pipe(
            map((raw: ServiceResult<T> | T) => {
                if (raw instanceof StreamableFile) return raw;

                if (isServiceResult(raw)) {
                    return createApiResponse(ApiStatuses.Success, (raw.data ?? null) as T | null, raw.message ?? 'OK', {
                        requestId,
                        page: raw.page,
                        count: raw.count,
                    });
                }

                return createApiResponse(ApiStatuses.Success, (raw ?? null) as T | null, 'OK', {
                    requestId,
                });
            }),
        );
    }
}

function isServiceResult<T>(value: ServiceResult<T> | T): value is ServiceResult<T> {
    return Boolean(value && typeof value === 'object' && 'data' in value);
}
