import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import type { OptimalCard } from '../../generated/common';

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

function toNumber(value: string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const numeric = Number(value);

    return Number.isFinite(numeric) ? numeric : null;
}

function relationId(value: { id: string } | null | undefined): string | null {
    return value?.id ?? null;
}

export class OptimalCardMapper {
    static toCard(entity: OptimalCardEntity): OptimalCard {
        const qtyMin = Number(entity.qtyMin);
        const qtyMax = Number(entity.qtyMax);

        return {
            id: entity.id,
            categoryId: entity.category.id,
            canonicalProductId: entity.canonicalProduct.id,
            nameRu: entity.canonicalProduct.nameRu,
            nameZh: entity.canonicalProduct.nameZh ?? null,
            qtyMin,
            qtyMax,
            quantityQuestionId: entity.quantityQuestion.id,
            isLive: entity.isLive,
            offerId: relationId(entity.offer),
            companyId: relationId(entity.company),
            storefrontId: relationId(entity.storefront),
            price: toNumber(entity.price),
            currency: entity.currency ?? null,
            contactValue: entity.contactValue ?? null,
            contactChannel: entity.contactChannel ?? null,
            contactUrl: entity.contactUrl ?? null,
            contactAdminEntered: entity.contactAdminEntered,
            contactEnteredAt: toIso(entity.contactEnteredAt),
            productAttributes: toAttributes(entity.productAttributes),
            reasonNote: entity.reasonNote ?? null,
            markedLiveByUserId: relationId(entity.markedLiveByUser),
            markedLiveAt: toIso(entity.markedLiveAt),
            expiresAt: toIso(entity.expiresAt),
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }
}

function toAttributes(value: unknown): OptimalCard['productAttributes'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as OptimalCard['productAttributes'];
}
