import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { ContactChannel } from '../../../../domain/enums/contact-channel.enum';
import { AttributeValue } from '../../../../domain/market/attribute-value';

export const OPTIMAL_CARD_SERVICE = Symbol('OPTIMAL_CARD_SERVICE');

export type CreateOptimalCardInput = {
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
    isLive?: boolean;
    price?: number | null;
    currency?: string | null;
    contactValue?: string | null;
    contactChannel?: ContactChannel | null;
    contactUrl?: string | null;
    contactAdminEntered?: boolean;
    reasonNote?: string | null;
    expiresAt?: Date | null;
};

export type UpdateOptimalCardInput = {
    adminUserId?: string;
    canonicalProductId?: string | null;
    nameRu?: string | null;
    nameZh?: string | null;
    qtyMin?: number;
    qtyMax?: number;
    quantityQuestionId?: string;
    productAttributes?: Record<string, AttributeValue>;
    isLive?: boolean;
    price?: number | null;
    currency?: string | null;
    contactValue?: string | null;
    contactChannel?: ContactChannel | null;
    contactUrl?: string | null;
    contactAdminEntered?: boolean;
    reasonNote?: string | null;
    expiresAt?: Date | null;
};

export interface OptimalCardService {
    create(input: CreateOptimalCardInput): Promise<OptimalCardEntity>;
    getById(id: string): Promise<OptimalCardEntity>;
    update(id: string, input: UpdateOptimalCardInput): Promise<OptimalCardEntity>;
}
