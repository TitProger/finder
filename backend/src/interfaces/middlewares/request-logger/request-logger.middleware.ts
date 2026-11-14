import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { registerOnRequestHook } from './on-request/register-on-request.hook';
import { registerOnResponseHook } from './on-response/register-on-response.hook';
import { registerOnErrorHook } from './on-error/register-on-error.hook';

export function useRequestLogger(app: NestFastifyApplication): void {
    const fastifyInstance = app.getHttpAdapter().getInstance();

    registerOnRequestHook(fastifyInstance);
    registerOnResponseHook(fastifyInstance);
    registerOnErrorHook(fastifyInstance);
}
