import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { SafeDossierReport } from '../../../../domain/market/safe-dossier-report';
import type { AdminDossier } from '../../generated/responses/dossiers';
import type { SafeDossierReport as SafeDossierReportDto } from '../../generated/common';

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

export class DossierMapper {
    static toAdmin(entity: OptimalCardEntity): AdminDossier {
        return {
            id: entity.id,
            categoryId: entity.category.id,
            canonicalProductId: entity.canonicalProduct.id,
            nameRu: entity.canonicalProduct.nameRu,
            nameZh: entity.canonicalProduct.nameZh ?? null,
            qtyMin: Number(entity.qtyMin),
            qtyMax: Number(entity.qtyMax),
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
            categoryReview: entity.categoryReview,
            offerReview: entity.offerReview,
            supplierReview: entity.supplierReview,
            reviewNote: entity.reviewNote ?? null,
            matchText: entity.matchText ?? null,
            publicReport: entity.publicReport ?? null,
            markedLiveByUserId: relationId(entity.markedLiveByUser),
            markedLiveAt: toIso(entity.markedLiveAt),
            revalidateAt: toIso(entity.revalidateAt),
            expiresAt: toIso(entity.expiresAt),
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }

    static toSafeReport(report: SafeDossierReport): SafeDossierReportDto {
        return {
            id: report.id,
            name: report.name,
            categoryLabel: report.categoryLabel,
            manufacturer: report.manufacturer ?? null,
            summary: report.summary ?? null,
            typicalPrice: report.typicalPrice,
            lowestCrediblePrice: report.lowestCrediblePrice,
            currency: report.currency,
            moqLabel: report.moqLabel,
            conditions: report.conditions,
            sources: report.sources,
            delivery: report.delivery,
            disclaimer: report.disclaimer,
            matchKind: report.matchKind,
            revalidateAt: report.revalidateAt,
            photos: report.photos,
            specs: report.specs,
            procurement: report.procurement ?? null,
            market: report.market ?? null,
            breakdown: report.breakdown ?? null,
        };
    }
}

function toAttributes(value: unknown): AdminDossier['productAttributes'] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as AdminDossier['productAttributes'];
}
