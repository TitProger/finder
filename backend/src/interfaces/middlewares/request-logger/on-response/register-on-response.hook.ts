import { FastifyInstance } from 'fastify';
import { Logger } from '../../../../common/logger/logger';
import { buildMeta } from '../shared/http-metadata';
import { calcDuration } from '../shared/request-state';
import { isMetricsRoute } from '../shared/route-check';
import { isClientError, isServerError } from '../shared/status-check';

export function registerOnResponseHook(instance: FastifyInstance): void {
    instance.addHook('onResponse', async (request, reply) => {
        if (isMetricsRoute(request.url)) {
            return;
        }

        const durationMs = calcDuration(request);
        const meta = buildMeta(request, reply.statusCode, durationMs);

        if (isServerError(reply.statusCode)) {
            Logger.error('HTTP запрос завершился с ошибкой сервера', Logger.statuses.FAIL, meta);

            return;
        }

        if (isClientError(reply.statusCode)) {
            Logger.warn('HTTP запрос завершился с ошибкой клиента', Logger.statuses.WARNING, meta);

            return;
        }

        Logger.info('HTTP запрос выполнен', Logger.statuses.SUCCESS, meta);
    });
}
