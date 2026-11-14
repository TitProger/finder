import { Entity, ManyToOne, Property, Rel, Unique } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';
import { VectorType } from '../common/vector.type';
import { CategoryEntity } from './category.entity';

@Entity({ tableName: 'category_phrase' })
@Unique({ properties: ['category', 'phrase'] })
export class CategoryPhraseEntity extends BaseEntity {
    @ManyToOne(() => CategoryEntity, {
        fieldName: 'category_id',
        deleteRule: 'cascade',
    })
    category!: Rel<CategoryEntity>;

    @Property({ type: 'text' })
    phrase!: string;

    @Property({ type: new VectorType(), nullable: true })
    embedding?: number[] | null;
}
