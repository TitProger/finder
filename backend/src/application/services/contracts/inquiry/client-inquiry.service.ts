import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';

export const CLIENT_INQUIRY_SERVICE = Symbol('CLIENT_INQUIRY_SERVICE');

export type CreateClientInquiryInput = {
    text: string;
    mediaIds?: string[];
    taxonomyNodeId?: number | null;
    profileJson?: Record<string, unknown> | null;
};

export interface ClientInquiryService {
    create(input: CreateClientInquiryInput): Promise<InquiryEntity>;
    getById(id: string): Promise<InquiryEntity>;
}
