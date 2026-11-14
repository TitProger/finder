export interface SourceContext {
    file?: string;
    function?: string;
    line?: number;
}

export interface HttpContext {
    method?: string;
    url?: string;
    status?: number;
    durationMs?: number;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    createdAt?: Date | string;
}

export interface ErrorContext {
    name?: string;
    message?: string;
    code?: string | number;
    stack?: string;
    context?: unknown;
}

export interface LogMeta {
    source?: SourceContext;
    http?: HttpContext;
    error?: ErrorContext;
    data?: unknown;
}

export const buildSourceContext = (source: SourceContext = {}) => {
    return {
        file: source.file,
        function: source.function,
        line: source.line,
    };
};

export const buildHttpContext = (http: HttpContext = {}) => {
    return {
        method: http.method,
        url: http.url,
        status: http.status,
        durationMs: http.durationMs,
        ip: http.ip,
        userAgent: http.userAgent,
        requestId: http.requestId,
        createdAt: http.createdAt,
    };
};

export function toErrorContext(error: unknown): ErrorContext {
    if (error instanceof Error) {
        const code =
            'code' in error && (typeof error.code === 'string' || typeof error.code === 'number')
                ? error.code
                : undefined;

        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code,
        };
    }

    return { message: String(error) };
}

export const buildErrorContext = (error: ErrorContext = {}) => {
    const errorContext: ErrorContext = {
        name: error.name,
        message: error.message,
        code: error.code,
    };

    if (
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'dev' ||
        process.env.NODE_ENV === 'debug' ||
        process.env.LOG_LEVEL === 'debug'
    ) {
        errorContext.stack = error.stack;
        errorContext.context = error.context;
    }

    return errorContext;
};

export const buildLogStructure = (level: string, message: string, status?: string, meta: LogMeta = {}) => {
    const structure: Record<string, unknown> = {
        level: level,
        message: message,
        date: new Date().toISOString(),
        status: status,
    };

    if (meta) {
        if (meta.source) {
            structure.source = buildSourceContext(meta.source);
        }

        if (meta.http) {
            structure.http = buildHttpContext(meta.http);
        }

        if (meta.error) {
            structure.error = buildErrorContext(meta.error);
        }

        if (meta.data) {
            structure.data = meta.data;
        }
    }

    return structure;
};

export const statuses = {
    PROCESS: 'PROCESS',
    SUCCESS: 'SUCCESS',
    FAIL: 'FAIL',
    WARNING: 'WARNING',
} as const;

export type LogStatus = (typeof statuses)[keyof typeof statuses];
