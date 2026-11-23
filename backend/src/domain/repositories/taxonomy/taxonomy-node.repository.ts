import { EntityRepository } from '@mikro-orm/postgresql';

import { TaxonomyNodeEntity } from '../../entities/taxonomy/taxonomy-node.entity';

export type TaxonomyPathSearchQuery = {
    q: string;
    limit?: number;
    parentId?: number;
};

export type TaxonomyAdminListQuery = {
    page?: number;
    limit?: number;
    q?: string;
    parentId?: number;
};

export type TaxonomyAdminListResult = {
    items: TaxonomyNodeEntity[];
    page: number;
    limit: number;
    total: number;
};

export interface TaxonomyNodeRepository extends EntityRepository<TaxonomyNodeEntity> {
    countAll(): Promise<number>;
    searchPaths(query: TaxonomyPathSearchQuery): Promise<TaxonomyNodeEntity[]>;
    listAdmin(query: TaxonomyAdminListQuery): Promise<TaxonomyAdminListResult>;
    findDescendants(rootId: number): Promise<TaxonomyNodeEntity[]>;
    bulkUpsert(nodes: TaxonomyNodeEntity[]): Promise<void>;
}

export type { TaxonomyNodeEntity };
