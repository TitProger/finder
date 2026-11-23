import { Inject, Injectable } from '@nestjs/common';

import { AppMessages } from '@/application/messages';
import {
    TAXONOMY_SERVICE,
    TaxonomyService,
} from '@/application/services/contracts/taxonomy/taxonomy.service';
import { ServiceResult } from '../../../common/service-result.interface';
import type { UpdateTaxonomyNodeRequest } from '../../../generated/requests/taxonomy';
import type { TaxonomyNode, TaxonomyPathSuggestion } from '../../../generated/responses/taxonomy';
import { TaxonomyMapper } from '../../../mappers/taxonomy/taxonomy.mapper';

export type TaxonomyPathQuery = {
    q: string;
    limit?: number;
    parentId?: number;
};

export type TaxonomyAdminQuery = {
    page?: number;
    limit?: number;
    q?: string;
    parentId?: number;
};

@Injectable()
export class TaxonomyHttpService {
    constructor(
        @Inject(TAXONOMY_SERVICE)
        private readonly taxonomy: TaxonomyService,
    ) {}

    async searchPaths(query: TaxonomyPathQuery): Promise<ServiceResult<TaxonomyPathSuggestion[]>> {
        const nodes = await this.taxonomy.searchPaths(query);

        return {
            data: nodes.map(TaxonomyMapper.toSuggestion),
            message: AppMessages.common.listed,
        };
    }

    async listAdmin(query: TaxonomyAdminQuery): Promise<ServiceResult<TaxonomyNode[]>> {
        const result = await this.taxonomy.listAdmin(query);
        const totalPages = result.limit > 0 ? Math.ceil(result.total / result.limit) : 0;

        return {
            data: result.items.map(TaxonomyMapper.toDto),
            message: AppMessages.common.listed,
            page: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages,
            },
        };
    }

    async updateNode(nodeId: number, body: UpdateTaxonomyNodeRequest): Promise<ServiceResult<TaxonomyNode>> {
        const node = await this.taxonomy.updateNode(nodeId, body);

        return {
            data: TaxonomyMapper.toDto(node),
            message: AppMessages.common.updated,
        };
    }
}
