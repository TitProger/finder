import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Envs } from '../envs/env';
import { Logger } from '../logger/logger';

/**
 * Подключает Swagger UI на статическую OpenAPI-спеку из api-contract
 * (`api/openapi.json`, результат `npm run contract:sync`).
 */
export function useSwagger(app: NestFastifyApplication): void {
    if (!Envs.swagger.enabled) {
        return;
    }

    const openapiPath = join(process.cwd(), Envs.swagger.openapiFile);

    if (!existsSync(openapiPath)) {
        Logger.warn(`OpenAPI-файл не найден: ${openapiPath}. Запустите npm run contract:sync`, Logger.statuses.FAIL);

        return;
    }

    const document = JSON.parse(readFileSync(openapiPath, 'utf8')) as OpenAPIObject;

    SwaggerModule.setup(Envs.swagger.path, app, document, {
        swaggerOptions: {
            tagsSorter: 'alpha',
            operationsSorter: 'alpha',
            persistAuthorization: true,
        },
    });
}
