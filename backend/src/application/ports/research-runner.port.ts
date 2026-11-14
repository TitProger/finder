import { InquiryStatus } from '../../domain/enums/inquiry-status.enum';

export type ResearchDiscardedItem = {
    path: string;
    reason: string;
};

export type ResearchIngestResult = {
    researchRunId: string;
    inquiryId: string;
    inquiryStatus: InquiryStatus;
    duplicate: boolean;
    counts: {
        companies: number;
        offers: number;
        contacts: number;
    };
    discarded: ResearchDiscardedItem[];
};

/**
 * Приём JSON-досье. Кто собрал досье, порт не выбирает.
 * Ответ не содержит цен: они остаются в offer для админа.
 */
export interface ResearchRunner {
    ingest(dossier: unknown): Promise<ResearchIngestResult>;
}

export const RESEARCH_RUNNER = Symbol('RESEARCH_RUNNER');
