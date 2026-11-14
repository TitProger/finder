export interface ExceptionContext {
    details?: unknown;
    code?: string | number;
}

export abstract class AppException extends Error {
    public readonly context?: ExceptionContext;
    public abstract readonly status: number;

    protected constructor(message: string, context?: ExceptionContext) {
        super(message);
        this.name = new.target.name;
        this.context = context;
    }
}
