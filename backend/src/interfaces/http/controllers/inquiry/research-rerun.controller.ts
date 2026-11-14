import { Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';

import {
    RESEARCH_LAUNCH_SERVICE,
    ResearchLaunchService,
} from '../../../../application/services/impls/research/research-launch.service';

/**
 * Повторный запуск ресерча. Статический ADMIN_API_TOKEN достаточен:
 * request.user не требуется, дневной лимит клиента не списывается.
 */
@Controller('admin/inquiries')
export class ResearchRerunController {
    constructor(
        @Inject(RESEARCH_LAUNCH_SERVICE)
        private readonly launch: ResearchLaunchService,
    ) {}

    @Post(':id/rerun-research')
    @HttpCode(200)
    async rerun(@Param('id') id: string) {
        const result = await this.launch.rerun(id);

        return {
            inquiryId: result.inquiryId,
            runId: result.runId,
            inquiryStatus: result.inquiryStatus,
            runStatus: result.runStatus,
        };
    }
}
