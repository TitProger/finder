import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';

import {
    PLAN_MANAGER_SERVICE,
    PlanManagerService,
} from '../../../../application/services/contracts/tariff/plan-manager.service';

type ChangePlanRequest = {
    userId: string;
    planCode: string;
};

@Controller('admin/plans')
export class PlanAdminController {
    constructor(
        @Inject(PLAN_MANAGER_SERVICE)
        private readonly planManager: PlanManagerService,
    ) {}

    @Post('change')
    async changePlan(@Body() body: ChangePlanRequest): Promise<{ success: boolean }> {
        await this.planManager.changePlan(body.userId, body.planCode);

        return { success: true };
    }

    @Get('user/:telegramUserId')
    async getUserPlan(@Param('telegramUserId') telegramUserId: string) {
        const info = await this.planManager.getUserPlanInfo(telegramUserId);

        if (!info) {
            return { found: false };
        }

        return {
            found: true,
            user: info,
        };
    }
}
