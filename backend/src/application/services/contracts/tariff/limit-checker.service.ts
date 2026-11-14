/**
 * Результат проверки дневного лимита.
 */
export type LimitCheckResult = { allowed: true } | { allowed: false; reason: string; limit: number; current: number };

/**
 * Сервис проверки дневных лимитов пользователей.
 */
export interface LimitCheckerService {
    /**
     * Проверяет, может ли пользователь запустить ресерч сегодня.
     * Админы из ADMIN_TELEGRAM_IDS всегда проходят проверку.
     */
    canStartResearch(userId: string, telegramUserId: string): Promise<LimitCheckResult>;

    /**
     * Увеличивает счётчик использования ресерча на 1 для текущего дня (Москва).
     */
    incrementResearchUsage(userId: string): Promise<void>;
}

export const LIMIT_CHECKER_SERVICE = Symbol('LIMIT_CHECKER_SERVICE');
