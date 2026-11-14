import { Inject, Injectable } from '@nestjs/common';

import { Envs } from '../../../../common/envs/env';
import { PlanRepository } from '../../../../domain/repositories/tariff/plan.repository';
import { DailyUsageRepository } from '../../../../domain/repositories/tariff/daily-usage.repository';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { LimitCheckerService, LimitCheckResult } from '../../contracts/tariff/limit-checker.service';

/**
 * Возвращает текущую дату в московском времени (YYYY-MM-DD).
 * Использует Intl API для корректной работы независимо от timezone сервера.
 */
function getMoscowDate(now: Date = new Date()): string {
    return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
}

/**
 * Проверяет, является ли Telegram ID админским из env.
 */
function isAdminTelegramId(telegramUserId: string): boolean {
    return Envs.admin.telegramIds.includes(telegramUserId);
}

@Injectable()
export class LimitCheckerServiceImpl implements LimitCheckerService {
    constructor(
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
        @Inject(REPOSITORY_TOKENS.PLAN_REPOSITORY)
        private readonly plans: PlanRepository,
        @Inject(REPOSITORY_TOKENS.DAILY_USAGE_REPOSITORY)
        private readonly dailyUsage: DailyUsageRepository,
    ) {}

    async canStartResearch(userId: string, telegramUserId: string): Promise<LimitCheckResult> {
        // Админы из env всегда безлимитные
        if (isAdminTelegramId(telegramUserId)) {
            return { allowed: true };
        }

        const user = await this.users.findOne({ id: userId });

        if (!user) {
            return { allowed: false, reason: 'Пользователь не найден', limit: 0, current: 0 };
        }

        const plan = await this.plans.findByCode(user.planCode);

        if (!plan) {
            return { allowed: false, reason: 'Тарифный план не найден', limit: 0, current: 0 };
        }

        // Тарифы с null лимитом безлимитные
        if (plan.dailyResearchLimit === null || plan.dailyResearchLimit === undefined) {
            return { allowed: true };
        }

        const today = getMoscowDate();
        const usage = await this.dailyUsage.findOrCreate(userId, today);

        if (usage.researchCount >= plan.dailyResearchLimit) {
            return {
                allowed: false,
                reason: `Превышен дневной лимит запросов (${plan.dailyResearchLimit} в день)`,
                limit: plan.dailyResearchLimit,
                current: usage.researchCount,
            };
        }

        return { allowed: true };
    }

    async incrementResearchUsage(userId: string): Promise<void> {
        const today = getMoscowDate();

        await this.dailyUsage.incrementResearchCount(userId, today);
    }
}
