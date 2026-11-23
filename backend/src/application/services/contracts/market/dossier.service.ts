import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { ContactChannel } from '../../../../domain/enums/contact-channel.enum';
import { DossierReviewDecision } from '../../../../domain/enums/dossier-review-decision.enum';
import { AttributeValue } from '../../../../domain/market/attribute-value';
import { SafeDossierReport, SafeDossierReportBody } from '../../../../domain/market/safe-dossier-report';

export const DOSSIER_SERVICE = Symbol('DOSSIER_SERVICE');

export type CreateDossierInput = {
    adminUserId?: string;
    categoryId: string;
    offerId?: string | null;
    canonicalProductId?: string | null;
    nameRu?: string | null;
    nameZh?: string | null;
    qtyMin: number;
    qtyMax: number;
    quantityQuestionId: string;
    productAttributes: Record<string, AttributeValue>;
    price?: number | null;
    currency?: string | null;
    contactValue?: string | null;
    contactChannel?: ContactChannel | null;
    contactUrl?: string | null;
    contactAdminEntered?: boolean;
    reasonNote?: string | null;
    matchText?: string | null;
    publicReport?: SafeDossierReportBody | null;
};

export type UpdateDossierInput = {
    adminUserId?: string;
    canonicalProductId?: string | null;
    nameRu?: string | null;
    nameZh?: string | null;
    qtyMin?: number;
    qtyMax?: number;
    quantityQuestionId?: string;
    productAttributes?: Record<string, AttributeValue>;
    price?: number | null;
    currency?: string | null;
    contactValue?: string | null;
    contactChannel?: ContactChannel | null;
    contactUrl?: string | null;
    contactAdminEntered?: boolean;
    reasonNote?: string | null;
    matchText?: string | null;
    publicReport?: SafeDossierReportBody | null;
};

export type ReviewDossierInput = {
    adminUserId?: string;
    target: 'category' | 'offer' | 'supplier';
    decision: DossierReviewDecision;
    note?: string | null;
};

export type PublishDossierInput = {
    adminUserId?: string;
    revalidateAt?: Date | null;
    publicReport?: SafeDossierReportBody | null;
};

export type ServeFromCacheInput = {
    categoryId: string;
    rawText: string;
    answers?: Array<{
        questionId: string;
        answerType: string;
        isRequired: boolean;
        valueText: string | null;
        valueJson: unknown;
    }>;
};

export type ServeFromCacheResult = {
    dossier: OptimalCardEntity;
    matchKind: 'exact' | 'similar';
};

export interface DossierService {
    create(input: CreateDossierInput): Promise<OptimalCardEntity>;
    getById(id: string): Promise<OptimalCardEntity>;
    update(id: string, input: UpdateDossierInput): Promise<OptimalCardEntity>;
    review(id: string, input: ReviewDossierInput): Promise<OptimalCardEntity>;
    publish(id: string, input: PublishDossierInput): Promise<OptimalCardEntity>;
    getSafeReport(id: string, matchKind?: 'exact' | 'similar' | null): Promise<SafeDossierReport>;
    getInquiryReport(inquiryId: string): Promise<SafeDossierReport>;
    findLiveForRequest(input: ServeFromCacheInput): Promise<ServeFromCacheResult | null>;
}
