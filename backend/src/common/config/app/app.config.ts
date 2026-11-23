import multipart from '@fastify/multipart';
import { HttpAdapterHost } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ApiExceptionFilter } from '../../../interfaces/http/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../../../interfaces/http/interceptors/api-response.interceptor';
import { useOpenApiValidation } from '../../../interfaces/http/validation/use-openapi-validation';
import { useHttpMiddlewares } from '../../../interfaces/middlewares/http-middlewares';
import { Envs } from '../../envs/env';
import { useSwagger } from '../../swagger/swagger';
import { MigrationService } from '../mikro-orm/migration.service';

/**
 * Настраивает компоненты приложения:
 * middleware, interceptors/filters, миграции, CORS,
 * валидацию запросов по OpenAPI (AJV), Swagger UI на статике.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
    await app.register(multipart, {
        limits: {
            files: 1,
            fileSize: 8 * 1024 * 1024,
        },
    });

    useHttpMiddlewares(app);
    useOpenApiValidation(app);

    app.useGlobalInterceptors(new ApiResponseInterceptor());

    const httpAdapterHost = app.get(HttpAdapterHost);

    app.useGlobalFilters(new ApiExceptionFilter(httpAdapterHost));

    await runMigrations(app);
    useCors(app);
    useSwagger(app);
}

function useCors(app: NestFastifyApplication): void {
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });
}

export async function runMigrations(app: NestFastifyApplication): Promise<void> {
    if (Envs.postgres.migrationsRun && Envs.postgres.host) {
        const migrationService = app.get(MigrationService);

        await migrationService.migrate();
    }
}
