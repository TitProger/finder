import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { PlanRepository } from '../../../../domain/repositories/tariff/plan.repository';
import { DailyUsageRepository } from '../../../../domain/repositories/tariff/daily-usage.repository';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { PlanManagerService, UserPlanView } from '../../contracts/tariff/plan-manager.service';

function getMoscowDate(now: Date = new Date()): string {
    return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
}

@Injectable()
export class PlanManagerServiceImpl implements PlanManagerService {
    constructor(
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
        @Inject(REPOSITORY_TOKENS.PLAN_REPOSITORY)
        private readonly plans: PlanRepository,
        @Inject(REPOSITORY_TOKENS.DAILY_USAGE_REPOSITORY)
        private readonly dailyUsage: DailyUsageRepository,
    ) {}

    async changePlan(userId: string, planCode: string): Promise<void> {
        const user = await this.users.findOne({ id: userId });

        if (!user) {
            throw new NotFoundAppException('Пользователь не найден', {
                code: AppErrors.auth.unauthorized.code,
            });
        }

        const plan = await this.plans.findByCode(planCode);

        if (!plan) {
            throw new NotFoundAppException(`Тарифный план '${planCode}' не найден`, {
                code: 'PLAN_NOT_FOUND',
            });
        }

        user.planCode = planCode;
        await this.users.getEntityManager().flush();
    }

    async getUserPlanInfo(telegramUserId: string): Promise<UserPlanView | null> {
        const user = await this.users.findOne({ telegramUserId });

        if (!user) {
            return null;
        }

        const plan = await this.plans.findByCode(user.planCode);

        if (!plan) {
            throw new NotFoundAppException(`Тарифный план '${user.planCode}' не найден`, {
                code: 'PLAN_NOT_FOUND',
            });
        }

        const today = getMoscowDate();
        const usage = await this.dailyUsage.findOrCreate(user.id, today);
        const dailyLimit = plan.dailyResearchLimit ?? null;
        const remaining = dailyLimit !== null ? dailyLimit - usage.researchCount : null;

        return {
            userId: user.id,
            telegramUserId: user.telegramUserId ?? null,
            displayName: user.displayName ?? null,
            currentPlan: {
                code: plan.code,
                title: plan.title,
                dailyLimit,
            },
            todayUsage: {
                date: today,
                count: usage.researchCount,
                remaining: remaining !== null && remaining < 0 ? 0 : remaining,
            },
        };
    }
}
