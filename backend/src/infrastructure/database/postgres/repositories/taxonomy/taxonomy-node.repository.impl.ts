import { FilterQuery } from '@mikro-orm/core';
import { EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { TaxonomyNodeEntity } from '../../../../../domain/entities/taxonomy/taxonomy-node.entity';
import {
    TaxonomyAdminListQuery,
    TaxonomyAdminListResult,
    TaxonomyNodeRepository,
    TaxonomyPathSearchQuery,
} from '../../../../../domain/repositories/taxonomy/taxonomy-node.repository';

@Injectable()
export class TaxonomyNodeRepositoryImpl
    extends EntityRepository<TaxonomyNodeEntity>
    implements TaxonomyNodeRepository
{
    constructor(
        @InjectRepository(TaxonomyNodeEntity)
        repository: EntityRepository<TaxonomyNodeEntity>,
    ) {
        super(repository.getEntityManager(), TaxonomyNodeEntity);
    }

    countAll(): Promise<number> {
        return this.count();
    }

    async searchPaths(query: TaxonomyPathSearchQuery): Promise<TaxonomyNodeEntity[]> {
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
        const q = query.q.trim();
        const where: FilterQuery<TaxonomyNodeEntity> = {
            $or: [
                { name: { $ilike: `%${escapeLike(q)}%` } },
                { pathLabel: { $ilike: `%${escapeLike(q)}%` } },
            ],
        };

        if (query.parentId != null) {
            where.parentId = query.parentId;
        }

        return this.find(where, {
            orderBy: [{ level: 'asc' }, { pathLabel: 'asc' }],
            limit,
        });
    }

    async listAdmin(query: TaxonomyAdminListQuery): Promise<TaxonomyAdminListResult> {
        const page = Math.max(query.page ?? 1, 1);
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const where: FilterQuery<TaxonomyNodeEntity> = {};

        if (query.parentId != null) {
            where.parentId = query.parentId;
        }

        const q = query.q?.trim();

        if (q) {
            where.$or = [
                { name: { $ilike: `%${escapeLike(q)}%` } },
                { pathLabel: { $ilike: `%${escapeLike(q)}%` } },
                { slug: { $ilike: `%${escapeLike(q)}%` } },
            ];
        }

        const [items, total] = await this.findAndCount(where, {
            orderBy: [{ level: 'asc' }, { pathLabel: 'asc' }],
            limit,
            offset: (page - 1) * limit,
        });

        return { items, page, limit, total };
    }

    async findDescendants(rootId: number): Promise<TaxonomyNodeEntity[]> {
        const knex = this.getEntityManager().getConnection().getKnex();
        const rows = (await knex.raw(
            `
            with recursive subtree as (
                select id from taxonomy_node where id = ?
                union all
                select child.id
                from taxonomy_node child
                inner join subtree on child.parent_id = subtree.id
            )
            select id from subtree where id <> ?
            `,
            [rootId, rootId],
        )) as { rows: Array<{ id: number }> };

        const ids = rows.rows.map((row) => row.id);

        if (ids.length === 0) {
            return [];
        }

        return this.find({ id: { $in: ids } });
    }

    async bulkUpsert(nodes: TaxonomyNodeEntity[]): Promise<void> {
        if (nodes.length === 0) {
            return;
        }

        const knex = this.getEntityManager().getConnection().getKnex();
        const rows = nodes.map((node) => ({
            id: node.id,
            parent_id: node.parentId,
            slug: node.slug,
            name: node.name,
            path_label: node.pathLabel,
            level: node.level,
            child_count: node.childCount,
            is_private: node.isPrivate,
            url: node.url ?? null,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
        }));

        await knex('taxonomy_node')
            .insert(rows)
            .onConflict('id')
            .merge([
                'parent_id',
                'slug',
                'name',
                'path_label',
                'level',
                'child_count',
                'is_private',
                'url',
                'updated_at',
            ]);
    }
}

function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
