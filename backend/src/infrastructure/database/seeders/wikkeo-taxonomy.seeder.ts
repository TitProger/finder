import { readFileSync } from 'node:fs';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { TaxonomyNodeEntity } from '../../../domain/entities/taxonomy/taxonomy-node.entity';
import { TaxonomyNodeRepository } from '../../../domain/repositories/taxonomy/taxonomy-node.repository';
import { REPOSITORY_TOKENS } from '../../../domain/repositories/repository.tokens';
import { resolveWikkeoCategoriesJson } from './wikkeo-taxonomy-path';

type WikkeoSourceNode = {
    id: number;
    parentId: number | null;
    slug: string;
    name: string;
    level: number;
    childCount?: number;
    isPrivate?: boolean;
    url?: string | null;
    children?: WikkeoSourceNode[];
};

type WikkeoSourceFile = {
    counts?: { totalNodes?: number };
    tree: WikkeoSourceNode[];
};

type FlatNode = {
    id: number;
    parentId: number | null;
    slug: string;
    name: string;
    level: number;
    childCount: number;
    isPrivate: boolean;
    url: string | null;
    pathLabel: string;
};

/**
 * Импорт дерева Wikkeo. Идемпотентно: повторный запуск upsert по id.
 * Семь плоских YAML-категорий не трогает — они шаблоны вопросов, не дерево.
 */
@Injectable()
export class WikkeoTaxonomySeeder {
    private readonly logger = new Logger(WikkeoTaxonomySeeder.name);

    constructor(
        @Inject(REPOSITORY_TOKENS.TAXONOMY_NODE_REPOSITORY)
        private readonly nodes: TaxonomyNodeRepository,
    ) {}

    async seed(sourcePath = resolveWikkeoCategoriesJson()): Promise<number> {
        const raw = JSON.parse(readFileSync(sourcePath, 'utf8')) as WikkeoSourceFile;
        const flat = flattenTree(raw.tree);
        const expected = raw.counts?.totalNodes ?? flat.length;

        if (flat.length !== expected) {
            throw new Error(`Снимок Wikkeo: ожидалось ${expected} узлов, в дереве ${flat.length}`);
        }

        this.logger.log(`Импорт таксономии Wikkeo: ${flat.length} узлов из ${sourcePath}`);

        const byLevel = new Map<number, FlatNode[]>();

        for (const item of flat) {
            const bucket = byLevel.get(item.level) ?? [];
            bucket.push(item);
            byLevel.set(item.level, bucket);
        }

        const chunkSize = 200;
        const levels = [...byLevel.keys()].sort((a, b) => a - b);

        for (const level of levels) {
            const items = byLevel.get(level) ?? [];

            for (let index = 0; index < items.length; index += chunkSize) {
                const chunk = items.slice(index, index + chunkSize).map((item) => {
                    const node = new TaxonomyNodeEntity();

                    node.id = item.id;
                    node.parentId = item.parentId;
                    node.slug = item.slug;
                    node.name = item.name;
                    node.pathLabel = item.pathLabel;
                    node.level = item.level;
                    node.childCount = item.childCount;
                    node.isPrivate = item.isPrivate;
                    node.url = item.url;

                    return node;
                });

                await this.nodes.bulkUpsert(chunk);
            }
        }

        const total = await this.nodes.countAll();

        if (total !== expected) {
            throw new Error(`После импорта в базе ${total} узлов, в источнике ${expected}`);
        }

        this.logger.log(`Таксономия Wikkeo: ${total} узлов`);

        return total;
    }
}

export function flattenTree(tree: WikkeoSourceNode[], parentPath: string[] = []): FlatNode[] {
    const out: FlatNode[] = [];

    for (const node of tree) {
        const path = [...parentPath, node.name];
        out.push({
            id: node.id,
            parentId: node.parentId,
            slug: node.slug,
            name: node.name,
            level: node.level,
            childCount: node.childCount ?? (node.children?.length ?? 0),
            isPrivate: node.isPrivate ?? false,
            url: node.url ?? null,
            pathLabel: path.join(' → '),
        });

        if (node.children?.length) {
            out.push(...flattenTree(node.children, path));
        }
    }

    return out;
}
