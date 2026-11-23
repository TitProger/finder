import { FilterQuery } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';

import { ListResult } from '../../../common/list-query';
import { SearchedProductEntity } from '@/domain/entities/catalog/searched-product.entity';
import { REPOSITORY_TOKENS } from '@/domain/repositories/repository.tokens';
import { SearchedProductRepository } from '@/domain/repositories/catalog/searched-product.repository';
import { CrudServiceImpl } from '../common/crud/crud.service.impl';

export type SearchedProductQuery = {
    page?: number;
    limit?: number;
    sort?: string;
    category?: string;
};

const SORT_FIELDS = new Set(['searchedAt', 'createdAt', 'updatedAt', 'name', 'materialCount', 'article']);

function sanitizeSort(sort?: string): string {
    const fallback = JSON.stringify({ searchedAt: 'desc' });

    if (!sort) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(sort) as Record<string, unknown>;
        const order: Record<string, 'asc' | 'desc'> = {};

        for (const [key, value] of Object.entries(parsed)) {
            if (SORT_FIELDS.has(key) && (value === 'asc' || value === 'desc')) {
                order[key] = value;
            }
        }

        return Object.keys(order).length > 0 ? JSON.stringify(order) : fallback;
    } catch {
        return fallback;
    }
}

@Injectable()
export class SearchedProductService extends CrudServiceImpl<
    SearchedProductEntity,
    SearchedProductRepository,
    SearchedProductQuery
> {
    constructor(
        @Inject(REPOSITORY_TOKENS.SEARCHED_PRODUCT_REPOSITORY)
        repository: SearchedProductRepository,
    ) {
        super(repository);
    }

    override async list(query?: SearchedProductQuery): Promise<ListResult<SearchedProductEntity>> {
        const next: SearchedProductQuery = {
            ...(query ?? {}),
            sort: sanitizeSort(query?.sort),
        };

        return super.list(next, { populate: ['coverFile'] });
    }

    override getById(id: string): Promise<SearchedProductEntity> {
        return super.getById(id, { populate: ['coverFile'] });
    }

    protected override buildListWhere(query: SearchedProductQuery): FilterQuery<SearchedProductEntity> {
        if (!query.category) {
            return {};
        }

        return { categoryLabel: query.category };
    }
}
