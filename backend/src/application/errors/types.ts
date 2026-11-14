/** Статическое или собранное сообщение об ошибке приложения. */
export type AppError = {
    readonly code: string;
    readonly message: string;
};

export function appError(code: string, message: string): AppError {
    return { code, message };
}
