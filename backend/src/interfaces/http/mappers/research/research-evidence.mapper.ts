import type { ResearchEvidenceView } from '../../../../application/services/contracts/research/research-evidence.service';
import type { ResearchEvidence } from '../../generated/responses/research';

export class ResearchEvidenceMapper {
    static toDto(view: ResearchEvidenceView): ResearchEvidence {
        return {
            runId: view.runId,
            inquiryId: view.inquiryId,
            items: view.items.map((item) => ({
                url: item.url,
                quote: item.quote,
                capturedAt: item.capturedAt.toISOString(),
                site: item.site,
                siteStatus: item.siteStatus as ResearchEvidence['items'][number]['siteStatus'],
            })),
        };
    }
}
