import { FastifyInstance } from 'fastify';
import { setTimestamps } from '../shared/request-state';

export function registerOnRequestHook(instance: FastifyInstance): void {
    // eslint-disable-next-line @typescript-eslint/require-await
    instance.addHook('onRequest', async (request) => {
        setTimestamps(request);
    });
}
