import { FastifyInstance } from 'fastify';
import { Logger } from '../../../../common/logger/logger';
import { buildMeta } from '../shared/http-metadata';
import { calcDuration } from '../shared/request-state';
import { isMetricsRoute } from '../shared/route-check';

export function registerOnErrorHook(instance: FastifyInstance): void {
    instance.addHook('onError', async (request, reply, error) => {
        if (isMetricsRoute(request.url)) {
            return;
        }

        const durationMs = calcDuration(request);

        Logger.error('HTTP запрос завершился с необработанной ошибкой', Logger.statuses.FAIL, {
            ...buildMeta(request, reply.statusCode ?? 500, durationMs),
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        });
    });
}
