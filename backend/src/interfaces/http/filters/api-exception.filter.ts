import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { createApiResponse, ApiStatuses } from '../common/api-response';
import { AppException } from '../../../common/exceptions/common/app.exception';
import { InternalServerAppException } from '../../../common/exceptions/internal-server.exception';
import { Logger } from '../../../common/logger/logger';

type ErrorWithMeta = Error & { code?: string | number; context?: unknown };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const { httpAdapter } = this.httpAdapterHost;
        const ctx = host.switchToHttp();
        const request = ctx.getRequest<FastifyRequest>();

        const { httpStatus, message, error } = this.normalizeException(exception);

        if (httpStatus >= 500) {
            Logger.error('Необработанная ошибка запроса', Logger.statuses.FAIL, {
                data: {
                    requestId: request.id,
                    method: request.method,
                    url: request.url,
                    message: exception instanceof Error ? exception.message : String(exception),
                    stack: exception instanceof Error ? exception.stack : undefined,
                },
            });
        }

        const body = createApiResponse(ApiStatuses.Error, null, message, {
            requestId: String(request.id),
            error,
        });

        httpAdapter.reply(ctx.getResponse<FastifyReply>(), body, httpStatus);
    }

    private normalizeException(exception: unknown): { httpStatus: number; message: string; error: Error } {
        if (exception instanceof AppException) {
            return this.formatAppException(exception);
        }

        if (exception instanceof HttpException) {
            const response = exception.getResponse();
            const httpStatus = exception.getStatus();
            const message = this.extractMessage(response, exception.message);
            const error: ErrorWithMeta = new Error(message);

            error.name = exception.name;
            error.code = httpStatus;
            error.context = this.extractDetails(response);

            return { httpStatus, message, error };
        }

        if (exception instanceof Error) {
            return this.formatAppException(
                new InternalServerAppException('Внутренняя ошибка сервера', {
                    code: readErrorCode(exception),
                    details: exception.message,
                }),
            );
        }

        return this.formatAppException(
            new InternalServerAppException('Внутренняя ошибка сервера', {
                details: typeof exception === 'string' ? exception : undefined,
            }),
        );
    }

    private extractMessage(response: unknown, fallback: string): string {
        if (!response) {
            return fallback;
        }

        if (typeof response === 'string') {
            return response;
        }

        if (typeof response === 'object') {
            const maybeMessage = (response as Record<string, unknown>).message;

            if (Array.isArray(maybeMessage)) {
                return maybeMessage.join(', ');
            }

            if (typeof maybeMessage === 'string') {
                return maybeMessage;
            }
        }

        return fallback;
    }

    private extractDetails(response: unknown): unknown {
        if (!response || typeof response !== 'object') {
            return undefined;
        }

        const record = response as Record<string, unknown>;

        return record.details ?? record.message;
    }

    private formatAppException(exception: AppException) {
        const httpStatus = exception.status;
        const error: ErrorWithMeta = new Error(exception.message);

        error.name = exception.name;
        error.code =
            exception instanceof InternalServerAppException ? httpStatus : (exception.context?.code ?? httpStatus);
        error.context = exception.context?.details;

        return { httpStatus, message: exception.message, error };
    }
}

function readErrorCode(error: Error): string | number | undefined {
    if (!('code' in error)) {
        return undefined;
    }

    const { code } = error as ErrorWithMeta;

    return typeof code === 'string' || typeof code === 'number' ? code : undefined;
}
