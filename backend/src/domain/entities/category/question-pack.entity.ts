import { Collection, Entity, ManyToOne, OneToMany, Property, Rel, Unique } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';
import { CategoryEntity } from './category.entity';
import { CategoryQuestionEntity } from './category-question.entity';

@Entity({ tableName: 'question_pack' })
@Unique({ properties: ['category', 'code'] })
export class QuestionPackEntity extends BaseEntity<'sortOrder' | 'isActive'> {
    @ManyToOne(() => CategoryEntity, {
        fieldName: 'category_id',
        deleteRule: 'cascade',
    })
    category!: Rel<CategoryEntity>;

    @Property({ type: 'varchar', length: 64 })
    code!: string;

    @Property({ type: 'varchar', length: 255 })
    title!: string;

    @Property({ type: 'text', nullable: true })
    description?: string | null;

    @Property({ type: 'int', fieldName: 'sort_order', default: 0 })
    sortOrder: number = 0;

    @Property({ type: 'boolean', fieldName: 'is_active', default: true })
    isActive: boolean = true;

    @OneToMany(() => CategoryQuestionEntity, (question) => question.questionPack)
    questions = new Collection<CategoryQuestionEntity>(this);
}
