import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';
import { CategoryEntity } from '../category/category.entity';

@Entity({ tableName: 'canonical_product' })
export class CanonicalProductEntity extends BaseEntity {
    @ManyToOne(() => CategoryEntity, {
        fieldName: 'category_id',
        deleteRule: 'restrict',
    })
    category!: Rel<CategoryEntity>;

    @Property({ type: 'varchar', length: 512, fieldName: 'name_ru' })
    nameRu!: string;

    @Property({ type: 'varchar', length: 512, fieldName: 'name_zh', nullable: true })
    nameZh?: string | null;

    @Property({ type: 'jsonb', nullable: true })
    attributes?: unknown;
}
