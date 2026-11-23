import { Injectable } from '@nestjs/common';

import { SearchedProductEntity } from '@/domain/entities/catalog/searched-product.entity';
import { SearchedProductDossier } from '@/domain/entities/catalog/searched-product.dossier';
import type { ProductPhoto } from '../../generated/common';
import type { ProductCard, ProductListItem } from '../../generated/responses/products';
import { EntityMapper } from '../common/entity-mapper.interface';

function fileUrl(id: string): string {
    return `/files/${id}/content`;
}

@Injectable()
export class SearchedProductMapper implements EntityMapper<SearchedProductEntity, ProductListItem> {
    toDto(entity: SearchedProductEntity): ProductListItem {
        return {
            id: entity.id,
            slug: entity.slug,
            name: entity.name,
            categoryLabel: entity.categoryLabel,
            chipLabel: entity.chipLabel ?? null,
            photoUrl: entity.coverFile ? fileUrl(entity.coverFile.id) : null,
            materialCount: entity.materialCount,
            searchedAt: entity.searchedAt.toISOString(),
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt ? entity.updatedAt.toISOString() : null,
        };
    }

    toDtoList(entities: SearchedProductEntity[]): ProductListItem[] {
        return entities.map((entity) => this.toDto(entity));
    }

    toCard(entity: SearchedProductEntity): ProductCard {
        const dossier: SearchedProductDossier | null = entity.dossier ?? null;
        const photos: ProductPhoto[] = (dossier?.photos ?? []).map((photo) => ({
            url: fileUrl(photo.fileId),
            alt: photo.alt,
        }));

        if (photos.length === 0 && entity.coverFile) {
            photos.push({ url: fileUrl(entity.coverFile.id), alt: entity.name });
        }

        return {
            ...this.toDto(entity),
            headline: dossier?.headline ?? null,
            cardCategoryLabel: dossier?.cardCategoryLabel ?? null,
            article: entity.article ?? null,
            manufacturer: dossier?.manufacturer ?? null,
            oemLabel: dossier?.oemLabel ?? null,
            summaryTitle: dossier?.summaryTitle ?? null,
            summary: dossier?.summary ?? null,
            availabilityLabel: dossier?.availabilityLabel ?? null,
            demandLabel: dossier?.demandLabel ?? null,
            galleryMoreLabel: dossier?.galleryMoreLabel ?? null,
            verifiedLabel: dossier?.verifiedLabel ?? null,
            updatedLabel: dossier?.updatedLabel ?? null,
            specsTitle: dossier?.specsTitle ?? null,
            passportLabel: dossier?.passportLabel ?? null,
            photos,
            specs: dossier?.specs ?? [],
            procurement: dossier?.procurement ?? null,
            delivery: dossier?.delivery ?? null,
            market: dossier?.market ?? null,
            breakdown: dossier?.breakdown ?? null,
        };
    }
}
