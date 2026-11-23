import { TaxonomyNodeEntity } from '../../../../domain/entities/taxonomy/taxonomy-node.entity';
import {
    TaxonomyAdminListQuery,
    TaxonomyAdminListResult,
    TaxonomyPathSearchQuery,
} from '../../../../domain/repositories/taxonomy/taxonomy-node.repository';

export const TAXONOMY_SERVICE = Symbol('TAXONOMY_SERVICE');

export type UpdateTaxonomyNodeInput = {
    name?: string;
    slug?: string;
    isPrivate?: boolean;
    url?: string | null;
};

export interface TaxonomyService {
    searchPaths(query: TaxonomyPathSearchQuery): Promise<TaxonomyNodeEntity[]>;
    listAdmin(query: TaxonomyAdminListQuery): Promise<TaxonomyAdminListResult>;
    updateNode(nodeId: number, input: UpdateTaxonomyNodeInput): Promise<TaxonomyNodeEntity>;
    requireNode(nodeId: number): Promise<TaxonomyNodeEntity>;
}
