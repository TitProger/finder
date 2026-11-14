import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyReply, FastifyRequest } from 'fastify';
import { BadRequestAppException } from '../../../common/exceptions/bad-request.exception';
import { Logger } from '../../../common/logger/logger';
import { OPENAPI_SKIP_PREFIXES, pathMatchesPrefix } from '../common/path-exceptions';
import { toOpenApiPath } from './openapi-document';
import { validateOpenApiRequest } from './openapi-validator';

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return {};
}

/**
 * Runtime-валидация входящих запросов по api/openapi.json (AJV).
 * Skip: docs / metrics (см. path-exceptions).
 */
export function useOpenApiValidation(app: NestFastifyApplication): void {
    const fastify = app.getHttpAdapter().getInstance();

    fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
        if (pathMatchesPrefix(request.url, OPENAPI_SKIP_PREFIXES)) {
            return;
        }

        const routeUrl = request.routeOptions?.url;

        if (!routeUrl || typeof routeUrl !== 'string') {
            return;
        }

        const openApiPath = toOpenApiPath(routeUrl);
        const failure = validateOpenApiRequest({
            openApiPath,
            method: request.method,
            query: asRecord(request.query),
            params: asRecord(request.params),
            body: request.body,
        });

        if (!failure) {
            return;
        }

        Logger.warn('Запрос не прошёл валидацию OpenAPI', Logger.statuses.FAIL, {
            data: {
                method: request.method,
                path: openApiPath,
                message: failure.message,
            },
        });

        throw new BadRequestAppException(failure.message, {
            code: 'OPENAPI_VALIDATION_FAILED',
            details: failure.details,
        });
    });

    Logger.info('OpenAPI request validation включена', Logger.statuses.SUCCESS, {
        data: { mode: 'ajv + api/openapi.json', skip: OPENAPI_SKIP_PREFIXES },
    });
}
