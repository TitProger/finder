import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Envs } from '../../../common/envs/env';

export type OpenApiDocument = {
    openapi?: string;
    paths?: Record<string, Record<string, OpenApiOperation | undefined> | undefined>;
    components?: Record<string, unknown>;
};

export type OpenApiParameterOrRef = OpenApiParameter | { $ref: string };

export type OpenApiOperation = {
    operationId?: string;
    parameters?: OpenApiParameterOrRef[];
    requestBody?: {
        required?: boolean;
        content?: Record<string, { schema?: object } | undefined>;
    };
};

export type OpenApiParameter = {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    required?: boolean;
    schema?: object;
};

let cached: OpenApiDocument | null = null;

/**
 * Загружает bundled OpenAPI (результат contract:sync).
 */
export function loadOpenApiDocument(): OpenApiDocument {
    if (cached) {
        return cached;
    }

    const openapiPath = join(process.cwd(), Envs.swagger.openapiFile);

    if (!existsSync(openapiPath)) {
        throw new Error(`OpenAPI-файл не найден: ${openapiPath}. Запустите npm run contract:sync`);
    }

    cached = JSON.parse(readFileSync(openapiPath, 'utf8')) as OpenApiDocument;

    return cached;
}

/** Сброс кеша (для тестов). */
export function resetOpenApiDocumentCache(): void {
    cached = null;
}

/**
 * Fastify `/items/:id` → OpenAPI `/items/{id}`.
 */
export function toOpenApiPath(routeUrl: string): string {
    const pathOnly = routeUrl.split('?')[0] || routeUrl;

    return pathOnly.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/**
 * JSON Pointer segment: `/` → `~1`, `~` → `~0`.
 */
export function encodeJsonPointerSegment(value: string): string {
    return value.replace(/~/g, '~0').replace(/\//g, '~1');
}
