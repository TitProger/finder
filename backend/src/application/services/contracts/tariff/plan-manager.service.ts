/**
 * Информация о плане и использовании пользователя.
 */
export type UserPlanView = {
    userId: string;
    telegramUserId: string | null;
    displayName: string | null;
    currentPlan: {
        code: string;
        title: string;
        dailyLimit: number | null;
    };
    todayUsage: {
        date: string;
        count: number;
        remaining: number | null;
    };
};

/**
 * Сервис управления тарифами пользователей.
 */
export interface PlanManagerService {
    /**
     * Изменяет тарифный план пользователя.
     */
    changePlan(userId: string, planCode: string): Promise<void>;

    /**
     * Получает информацию о плане и использовании пользователя по Telegram ID.
     */
    getUserPlanInfo(telegramUserId: string): Promise<UserPlanView | null>;
}

export const PLAN_MANAGER_SERVICE = Symbol('PLAN_MANAGER_SERVICE');
