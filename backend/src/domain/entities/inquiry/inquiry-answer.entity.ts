import { Entity, ManyToOne, Property, Rel, Unique } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';
import { CategoryQuestionEntity } from '../category/category-question.entity';
import { InquiryEntity } from './inquiry.entity';

@Entity({ tableName: 'inquiry_answer' })
@Unique({ properties: ['inquiry', 'categoryQuestion'] })
export class InquiryAnswerEntity extends BaseEntity<'answeredAt'> {
    @ManyToOne(() => InquiryEntity, {
        fieldName: 'inquiry_id',
        deleteRule: 'cascade',
    })
    inquiry!: Rel<InquiryEntity>;

    @ManyToOne(() => CategoryQuestionEntity, {
        fieldName: 'category_question_id',
        deleteRule: 'restrict',
    })
    categoryQuestion!: Rel<CategoryQuestionEntity>;

    @Property({ type: 'text', fieldName: 'value_text', nullable: true })
    valueText?: string | null;

    @Property({ type: 'jsonb', fieldName: 'value_json', nullable: true })
    valueJson?: unknown;

    @Property({
        type: 'timestamptz',
        fieldName: 'answered_at',
        onCreate: () => new Date(),
        defaultRaw: 'NOW()',
    })
    answeredAt!: Date;
}
