import { Inject, Injectable } from '@nestjs/common';

import { AppMessages } from '@/application/messages';
import {
    RESEARCH_EVIDENCE_SERVICE,
    ResearchEvidenceService,
} from '@/application/services/contracts/research/research-evidence.service';
import { ServiceResult } from '../../../common/service-result.interface';
import type { ResearchEvidence } from '../../../generated/responses/research';
import { ResearchEvidenceMapper } from '../../../mappers/research/research-evidence.mapper';

@Injectable()
export class ResearchEvidenceHttpService {
    constructor(
        @Inject(RESEARCH_EVIDENCE_SERVICE)
        private readonly evidence: ResearchEvidenceService,
    ) {}

    async getByRunId(runId: string): Promise<ServiceResult<ResearchEvidence>> {
        const view = await this.evidence.getByRunId(runId);

        return {
            data: ResearchEvidenceMapper.toDto(view),
            message: AppMessages.common.fetched,
        };
    }
}
