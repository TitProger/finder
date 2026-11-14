import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';

import { RESEARCH_RUNNER, ResearchRunner } from '../../../../application/ports/research-runner.port';
import { Public } from '../../auth/public.decorator';
import { ResearchIngestGuard } from '../../auth/research-ingest.guard';
import type { ResearchDossier } from '../../generated/requests/research';
import type { ResearchIngestResult } from '../../generated/responses/research';

@Public()
@Controller('research')
export class ResearchIngestController {
    constructor(
        @Inject(RESEARCH_RUNNER)
        private readonly runner: ResearchRunner,
    ) {}

    @Post('ingest')
    @HttpCode(200)
    @UseGuards(ResearchIngestGuard)
    async ingest(@Body() body: ResearchDossier): Promise<ResearchIngestResult> {
        const result = await this.runner.ingest(body);

        return {
            research_run_id: result.researchRunId,
            inquiry_id: result.inquiryId,
            inquiry_status: result.inquiryStatus,
            duplicate: result.duplicate,
            counts: result.counts,
            discarded: result.discarded,
        };
    }
}
