import { Collection, Entity, Enum, OneToMany, Property, Unique } from '@mikro-orm/core';

import { CategoryStatus } from '../../enums/category-status.enum';
import { BaseEntity } from '../common/base.entity';
import { VectorType } from '../common/vector.type';
import { CategoryPhraseEntity } from './category-phrase.entity';
import { CategoryQuestionEntity } from './category-question.entity';
import { CategorySiteEntity } from './category-site.entity';
import { QuestionPackEntity } from './question-pack.entity';

@Entity({ tableName: 'category' })
export class CategoryEntity extends BaseEntity<'status'> {
    @Property({ type: 'varchar', length: 64, nullable: true })
    @Unique()
    code?: string | null;

    @Property({ type: 'varchar', length: 255 })
    @Unique()
    name!: string;

    @Property({ type: 'text' })
    description!: string;

    @Enum({ items: () => CategoryStatus, nativeEnumName: 'category_status', default: CategoryStatus.ACTIVE })
    status: CategoryStatus = CategoryStatus.ACTIVE;

    @Property({ type: new VectorType(), nullable: true })
    embedding?: number[] | null;

    @OneToMany(() => CategoryPhraseEntity, (phrase) => phrase.category)
    phrases = new Collection<CategoryPhraseEntity>(this);

    @OneToMany(() => QuestionPackEntity, (pack) => pack.category)
    questionPacks = new Collection<QuestionPackEntity>(this);

    @OneToMany(() => CategoryQuestionEntity, (question) => question.category)
    questions = new Collection<CategoryQuestionEntity>(this);

    @OneToMany(() => CategorySiteEntity, (site) => site.category)
    sites = new Collection<CategorySiteEntity>(this);
}
