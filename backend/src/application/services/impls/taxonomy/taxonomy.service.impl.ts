import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import {
    TaxonomyService,
    UpdateTaxonomyNodeInput,
} from '../../contracts/taxonomy/taxonomy.service';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { TaxonomyNodeEntity } from '../../../../domain/entities/taxonomy/taxonomy-node.entity';
import {
    TaxonomyAdminListQuery,
    TaxonomyAdminListResult,
    TaxonomyNodeRepository,
    TaxonomyPathSearchQuery,
} from '../../../../domain/repositories/taxonomy/taxonomy-node.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';

@Injectable()
export class TaxonomyServiceImpl implements TaxonomyService {
    constructor(
        @Inject(REPOSITORY_TOKENS.TAXONOMY_NODE_REPOSITORY)
        private readonly nodes: TaxonomyNodeRepository,
    ) {}

    searchPaths(query: TaxonomyPathSearchQuery): Promise<TaxonomyNodeEntity[]> {
        const q = query.q?.trim();

        if (!q) {
            throw new BadRequestAppException(AppErrors.common.emptyFilter.message, {
                code: AppErrors.common.emptyFilter.code,
            });
        }

        return this.nodes.searchPaths({
            q,
            limit: query.limit,
            parentId: query.parentId,
        });
    }

    listAdmin(query: TaxonomyAdminListQuery): Promise<TaxonomyAdminListResult> {
        return this.nodes.listAdmin(query);
    }

    async requireNode(nodeId: number): Promise<TaxonomyNodeEntity> {
        const node = await this.nodes.findOne({ id: nodeId });

        if (!node) {
            throw new NotFoundAppException(AppErrors.taxonomy.notFound.message, {
                code: AppErrors.taxonomy.notFound.code,
            });
        }

        return node;
    }

    async updateNode(nodeId: number, input: UpdateTaxonomyNodeInput): Promise<TaxonomyNodeEntity> {
        const node = await this.requireNode(nodeId);
        const nameChanged = input.name != null && input.name !== node.name;

        if (input.name != null) {
            node.name = input.name.trim();
        }

        if (input.slug != null) {
            node.slug = input.slug.trim();
        }

        if (input.isPrivate != null) {
            node.isPrivate = input.isPrivate;
        }

        if (input.url !== undefined) {
            node.url = input.url;
        }

        if (nameChanged) {
            await this.rebuildPaths(node);
        }

        const em = this.nodes.getEntityManager();

        em.persist(node);
        await em.flush();

        return node;
    }

    private async rebuildPaths(node: TaxonomyNodeEntity): Promise<void> {
        const parent = node.parentId != null ? await this.nodes.findOne({ id: node.parentId }) : null;
        node.pathLabel = parent ? `${parent.pathLabel} → ${node.name}` : node.name;

        const descendants = await this.nodes.findDescendants(node.id);
        const byId = new Map<number, TaxonomyNodeEntity>();

        byId.set(node.id, node);

        for (const item of descendants) {
            byId.set(item.id, item);
        }

        for (const child of descendants.sort((a, b) => a.level - b.level)) {
            const parentNode = child.parentId != null ? byId.get(child.parentId) : null;
            child.pathLabel = parentNode ? `${parentNode.pathLabel} → ${child.name}` : child.name;
            byId.set(child.id, child);
        }
    }
}
