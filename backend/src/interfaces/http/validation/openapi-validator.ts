import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import {
    encodeJsonPointerSegment,
    loadOpenApiDocument,
    type OpenApiDocument,
    type OpenApiOperation,
    type OpenApiParameter,
    type OpenApiParameterOrRef,
} from './openapi-document';

type AjvInstance = Ajv2020;

/** $id, под которым в AJV зарегистрирован bundled OpenAPI. */
const OPENAPI_SCHEMA_ID = 'openapi.json';

let ajvInstance: AjvInstance | null = null;
const compiled = new Map<string, ValidateFunction>();

function getAjv(document: OpenApiDocument): AjvInstance {
    if (ajvInstance) {
        return ajvInstance;
    }

    const ajv = new Ajv2020({
        allErrors: true,
        coerceTypes: true,
        removeAdditional: false,
        strict: false,
        validateSchema: false,
    });

    addFormats(ajv);

    ajv.addSchema({
        $id: OPENAPI_SCHEMA_ID,
        ...document,
    });

    ajvInstance = ajv;

    return ajv;
}

function getValidator(ajv: AjvInstance, ref: string): ValidateFunction {
    const cached = compiled.get(ref);

    if (cached) {
        return cached;
    }

    const validate = ajv.compile({ $ref: ref });

    compiled.set(ref, validate);

    return validate;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
    if (!errors?.length) {
        return 'Тело или параметры запроса не соответствуют контракту';
    }

    return errors
        .map((error) => {
            const path = error.instancePath || '/';

            return `${path} ${error.message ?? 'невалидно'}`.trim();
        })
        .join('; ');
}

/**
 * Документ-относительные `$ref` (`#/components/...`) при отдельной компиляции
 * схемы не резолвятся — переписываем на абсолютные относительно OPENAPI_SCHEMA_ID.
 */
function toAbsoluteOpenApiRef(ref: string): string {
    if (ref.startsWith('#/')) {
        return `${OPENAPI_SCHEMA_ID}${ref}`;
    }

    return ref;
}

function rewriteSchemaRefs(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(rewriteSchemaRefs);
    }

    if (value && typeof value === 'object') {
        const result: Record<string, unknown> = {};

        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            result[key] =
                key === '$ref' && typeof nested === 'string' ? toAbsoluteOpenApiRef(nested) : rewriteSchemaRefs(nested);
        }

        return result;
    }

    return value;
}

/**
 * Разыменовывает `#/components/parameters/...` (и вложенные `$ref`) в конкретный параметр.
 */
function resolveOpenApiRef(document: OpenApiDocument, ref: string): unknown {
    if (!ref.startsWith('#/')) {
        throw new Error(`Неподдерживаемый OpenAPI $ref: ${ref}`);
    }

    const segments = ref
        .slice(2)
        .split('/')
        .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

    let current: unknown = document;

    for (const segment of segments) {
        if (!current || typeof current !== 'object' || !(segment in current)) {
            throw new Error(`Не удалось разрешить OpenAPI $ref: ${ref}`);
        }

        current = (current as Record<string, unknown>)[segment];
    }

    if (current && typeof current === 'object' && '$ref' in current) {
        return resolveOpenApiRef(document, (current as { $ref: string }).$ref);
    }

    return current;
}

function resolveParameters(
    document: OpenApiDocument,
    parameters: OpenApiParameterOrRef[] | undefined,
): OpenApiParameter[] {
    if (!parameters?.length) {
        return [];
    }

    return parameters.map((parameter) => {
        if ('$ref' in parameter && typeof parameter.$ref === 'string') {
            return resolveOpenApiRef(document, parameter.$ref) as OpenApiParameter;
        }

        return parameter as OpenApiParameter;
    });
}

function buildParametersObjectSchema(parameters: OpenApiParameter[], location: OpenApiParameter['in']): object | null {
    const filtered = parameters.filter((parameter) => parameter.in === location);

    if (filtered.length === 0) {
        return null;
    }

    const properties: Record<string, object> = {};
    const required: string[] = [];

    for (const parameter of filtered) {
        properties[parameter.name] = rewriteSchemaRefs(parameter.schema ?? {}) as object;

        if (parameter.required) {
            required.push(parameter.name);
        }
    }

    return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
        additionalProperties: true,
    };
}

function resolveOperation(
    document: OpenApiDocument,
    openApiPath: string,
    method: string,
): OpenApiOperation | undefined {
    const pathItem = document.paths?.[openApiPath];

    if (!pathItem) {
        return undefined;
    }

    return pathItem[method.toLowerCase()];
}

export type OpenApiValidationFailure = {
    message: string;
    details: ErrorObject[] | null | undefined;
};

/**
 * Валидирует query / path / body операции по bundled OpenAPI.
 * Если у операции нет схем — считается успехом (нечего проверять).
 */
export function validateOpenApiRequest(input: {
    openApiPath: string;
    method: string;
    query: Record<string, unknown>;
    params: Record<string, unknown>;
    body: unknown;
}): OpenApiValidationFailure | null {
    const document = loadOpenApiDocument();
    const operation = resolveOperation(document, input.openApiPath, input.method);

    // Маршрут вне контракта — не валидируем здесь (docs и служебные пути отфильтрованы раньше).
    if (!operation) {
        return null;
    }

    const ajv = getAjv(document);
    const pathPointer = encodeJsonPointerSegment(input.openApiPath);
    const method = input.method.toLowerCase();
    const parameters = resolveParameters(document, operation.parameters);

    const querySchema = buildParametersObjectSchema(parameters, 'query');

    if (querySchema) {
        const validateQuery = ajv.compile(querySchema);

        if (!validateQuery(input.query)) {
            return {
                message: `Query: ${formatAjvErrors(validateQuery.errors)}`,
                details: validateQuery.errors,
            };
        }
    }

    const pathSchema = buildParametersObjectSchema(parameters, 'path');

    if (pathSchema) {
        const validatePath = ajv.compile(pathSchema);

        if (!validatePath(input.params)) {
            return {
                message: `Path: ${formatAjvErrors(validatePath.errors)}`,
                details: validatePath.errors,
            };
        }
    }

    const jsonBody = operation.requestBody?.content?.['application/json'];

    if (jsonBody?.schema) {
        const bodyRequired = operation.requestBody?.required === true;
        const bodyMissing = input.body === undefined || input.body === null;

        if (bodyMissing && bodyRequired) {
            return {
                message: 'Body: требуется тело запроса application/json',
                details: null,
            };
        }

        if (!bodyMissing) {
            const bodyRef = `${OPENAPI_SCHEMA_ID}#/paths/${pathPointer}/${method}/requestBody/content/${encodeJsonPointerSegment('application/json')}/schema`;
            const validateBody = getValidator(ajv, bodyRef);

            if (!validateBody(input.body)) {
                return {
                    message: `Body: ${formatAjvErrors(validateBody.errors)}`,
                    details: validateBody.errors,
                };
            }
        }
    }

    return null;
}
