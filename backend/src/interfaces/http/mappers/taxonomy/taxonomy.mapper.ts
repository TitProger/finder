import { TaxonomyNodeEntity } from '../../../../domain/entities/taxonomy/taxonomy-node.entity';
import type { TaxonomyNode, TaxonomyPathSuggestion } from '../../generated/responses/taxonomy';

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

/** API ↔ домен для узлов Wikkeo. */
export class TaxonomyMapper {
    static toSuggestion(node: TaxonomyNodeEntity): TaxonomyPathSuggestion {
        return {
            nodeId: node.id,
            parentId: node.parentId,
            slug: node.slug,
            name: node.name,
            pathLabel: node.pathLabel,
            level: node.level,
        };
    }

    static toDto(node: TaxonomyNodeEntity): TaxonomyNode {
        return {
            nodeId: node.id,
            parentId: node.parentId,
            slug: node.slug,
            name: node.name,
            pathLabel: node.pathLabel,
            level: node.level,
            childCount: node.childCount,
            isPrivate: node.isPrivate,
            url: node.url ?? null,
            createdAt: node.createdAt.toISOString(),
            updatedAt: toIso(node.updatedAt),
        };
    }
}
