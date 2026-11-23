import { Entity, Index, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Узел дерева Wikkeo. PK = id из источника (не UUID).
 * Семь плоских категорий из seeds/categories.yaml — отдельный справочник.
 */
@Entity({ tableName: 'taxonomy_node' })
export class TaxonomyNodeEntity {
    [OptionalProps]?: 'createdAt' | 'updatedAt' | 'childCount' | 'isPrivate';

    @PrimaryKey({ type: 'int' })
    id!: number;

    @Property({ type: 'int', fieldName: 'parent_id', nullable: true })
    @Index({ name: 'taxonomy_node_parent_id_idx' })
    parentId!: number | null;

    @Property({ type: 'varchar', length: 255 })
    @Index({ name: 'taxonomy_node_slug_idx' })
    slug!: string;

    @Property({ type: 'varchar', length: 255 })
    name!: string;

    @Property({ type: 'text', fieldName: 'path_label' })
    @Index({ name: 'taxonomy_node_path_label_idx' })
    pathLabel!: string;

    @Property({ type: 'int' })
    level!: number;

    @Property({ type: 'int', fieldName: 'child_count', default: 0 })
    childCount: number = 0;

    @Property({ type: 'boolean', fieldName: 'is_private', default: false })
    isPrivate: boolean = false;

    @Property({ type: 'varchar', length: 2048, nullable: true })
    url?: string | null;

    @Property({
        type: 'timestamptz',
        fieldName: 'created_at',
        onCreate: () => new Date(),
        defaultRaw: 'NOW()',
    })
    createdAt!: Date;

    @Property({
        type: 'timestamptz',
        fieldName: 'updated_at',
        nullable: true,
        onUpdate: () => new Date(),
        defaultRaw: 'NOW()',
    })
    updatedAt!: Date | null;
}
