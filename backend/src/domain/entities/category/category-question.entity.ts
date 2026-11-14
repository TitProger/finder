import { Entity, Enum, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { QuestionAnswerType } from '../../enums/question-answer-type.enum';
import { BaseEntity } from '../common/base.entity';
import { CategoryEntity } from './category.entity';
import { QuestionPackEntity } from './question-pack.entity';

@Entity({ tableName: 'category_question' })
export class CategoryQuestionEntity extends BaseEntity<'isRequired' | 'sortOrder'> {
    @ManyToOne(() => CategoryEntity, {
        fieldName: 'category_id',
        deleteRule: 'cascade',
    })
    category!: Rel<CategoryEntity>;

    @ManyToOne(() => QuestionPackEntity, {
        fieldName: 'question_pack_id',
        deleteRule: 'cascade',
        nullable: true,
    })
    questionPack?: Rel<QuestionPackEntity> | null;

    @Property({ type: 'text' })
    prompt!: string;

    @Enum({ items: () => QuestionAnswerType, nativeEnumName: 'question_answer_type', fieldName: 'answer_type' })
    answerType!: QuestionAnswerType;

    @Property({ type: 'jsonb', nullable: true })
    choices?: unknown | null;

    @Property({ type: 'boolean', fieldName: 'is_required', default: true })
    isRequired: boolean = true;

    @Property({ type: 'int', fieldName: 'sort_order', default: 0 })
    sortOrder: number = 0;
}
