import { InquiryStatus } from '../../domain/enums/inquiry-status.enum';

/**
 * Розетка досье. Кто собрал JSON — модель, бот или сборщик — этот порт не выбирает.
 * Поля в camelCase, как остальной JSON сервиса.
 * companies[].ref и storefronts[].ref — ключи внутри одного JSON, не id базы.
 * Оффер — sourceUrl и quoteText. Снимок — layer и samplePoints с price, url, label.
 */
export type ResearchIngestResult = {
    researchRunId: string;
    inquiryId: string;
    status: InquiryStatus;
    companyIds: string[];
    storefrontIds: string[];
    offerIds: string[];
    marketSnapshotIds: string[];
    discarded: readonly string[];
};

export interface ResearchRunner {
    ingest(inquiryId: string, dossier: unknown): Promise<ResearchIngestResult>;
}

export const RESEARCH_RUNNER = Symbol('RESEARCH_RUNNER');
