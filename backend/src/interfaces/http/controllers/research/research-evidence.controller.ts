import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { ResearchEvidenceHttpService } from '../../services/impls/research/research-evidence.http-service';

/**
 * Сырые свидетельства прогона. Только админский Bearer.
 */
@Controller('admin/research/runs')
export class ResearchEvidenceController {
    constructor(private readonly evidence: ResearchEvidenceHttpService) {}

    @Get(':runId/evidence')
    getByRunId(@Param('runId', ParseUUIDPipe) runId: string) {
        return this.evidence.getByRunId(runId);
    }
}
