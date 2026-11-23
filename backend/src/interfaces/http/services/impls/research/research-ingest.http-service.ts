import { Inject, Injectable } from '@nestjs/common';

import { AppMessages } from '@/application/messages';
import { RESEARCH_RUNNER, ResearchRunner } from '@/application/ports/research-runner.port';
import { ServiceResult } from '../../../common/service-result.interface';
import type { ResearchDossier } from '../../../generated/requests/research';
import type { ResearchIngestResult } from '../../../generated/responses/research';
import { ResearchIngestMapper } from '../../../mappers/research/research-ingest.mapper';

@Injectable()
export class ResearchIngestHttpService {
    constructor(
        @Inject(RESEARCH_RUNNER)
        private readonly runner: ResearchRunner,
    ) {}

    async ingest(body: ResearchDossier): Promise<ServiceResult<ResearchIngestResult>> {
        const result = await this.runner.ingest(body);

        return {
            data: ResearchIngestMapper.toDto(result),
            message: AppMessages.common.created,
        };
    }
}
