import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { useRequestLogger } from './request-logger/request-logger.middleware';

/**
 * Подключает HTTP middleware интерфейсного слоя.
 */
export function useHttpMiddlewares(app: NestFastifyApplication): void {
    useRequestLogger(app);
}
