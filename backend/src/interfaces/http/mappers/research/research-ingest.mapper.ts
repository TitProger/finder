import type { ResearchIngestResult as DomainIngestResult } from '../../../../application/ports/research-runner.port';
import type { ResearchIngestResult } from '../../generated/responses/research';

export class ResearchIngestMapper {
    static toDto(result: DomainIngestResult): ResearchIngestResult {
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
