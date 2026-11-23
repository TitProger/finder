export const RESEARCH_EVIDENCE_SERVICE = Symbol('RESEARCH_EVIDENCE_SERVICE');

export type ResearchEvidenceItemView = {
    url: string;
    quote: string | null;
    capturedAt: Date;
    site: string | null;
    siteStatus: string;
};

export type ResearchEvidenceView = {
    runId: string;
    inquiryId: string;
    items: ResearchEvidenceItemView[];
};

export interface ResearchEvidenceService {
    getByRunId(runId: string): Promise<ResearchEvidenceView>;
}
