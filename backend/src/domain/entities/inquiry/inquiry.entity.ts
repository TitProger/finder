import { Entity, Enum, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { InquiryStatus } from '../../enums/inquiry-status.enum';
import { ClassificationScores } from '../../inquiry/classification';
import { BaseEntity } from '../common/base.entity';
import { CategoryEntity } from '../category/category.entity';
import { QuestionPackEntity } from '../category/question-pack.entity';
import { OptimalCardEntity } from '../market/optimal-card.entity';
import { TaxonomyNodeEntity } from '../taxonomy/taxonomy-node.entity';
import { AppUserEntity } from '../user/app-user.entity';

@Entity({ tableName: 'inquiry' })
export class InquiryEntity extends BaseEntity<'status' | 'photoUrls' | 'isPaused'> {
    @ManyToOne(() => AppUserEntity, {
        fieldName: 'client_user_id',
        deleteRule: 'restrict',
    })
    clientUser!: Rel<AppUserEntity>;

    @Enum({ items: () => InquiryStatus, nativeEnumName: 'inquiry_status', default: InquiryStatus.DRAFT })
    status: InquiryStatus = InquiryStatus.DRAFT;

    @Property({ type: 'text', fieldName: 'raw_text' })
    rawText!: string;

    @Property({ type: 'text[]', fieldName: 'photo_urls', default: '{}' })
    photoUrls: string[] = [];

    /**
     * Ответы анкеты сайта. Недостающее — null.
     * Для веб-заявки photo_urls хранит uuid файлов хранилища, не Telegram file_id.
     */
    @Property({ type: 'jsonb', fieldName: 'profile_json', nullable: true })
    profileJson?: Record<string, unknown> | null;

    @ManyToOne(() => CategoryEntity, {
        fieldName: 'category_id',
        deleteRule: 'set null',
        nullable: true,
    })
    category?: Rel<CategoryEntity> | null;

    /**
     * Узел дерева Wikkeo. Истина категории для сайта.
     * Старый category_id — плоский классификатор, не дерево.
     */
    @ManyToOne(() => TaxonomyNodeEntity, {
        fieldName: 'taxonomy_node_id',
        deleteRule: 'set null',
        nullable: true,
    })
    taxonomyNode?: Rel<TaxonomyNodeEntity> | null;

    @ManyToOne(() => QuestionPackEntity, {
        fieldName: 'question_pack_id',
        deleteRule: 'set null',
        nullable: true,
    })
    questionPack?: Rel<QuestionPackEntity> | null;

    @Property({ type: 'jsonb', fieldName: 'classification_scores', nullable: true })
    classificationScores?: ClassificationScores | null;

    @Property({ type: 'boolean', fieldName: 'is_paused', default: false })
    isPaused: boolean = false;

    @Property({ type: 'text', fieldName: 'pause_reason', nullable: true })
    pauseReason?: string | null;

    @ManyToOne(() => AppUserEntity, {
        fieldName: 'assigned_by_user_id',
        deleteRule: 'set null',
        nullable: true,
    })
    assignedByUser?: Rel<AppUserEntity> | null;

    @ManyToOne(() => OptimalCardEntity, {
        fieldName: 'optimal_card_id',
        deleteRule: 'set null',
        nullable: true,
    })
    optimalCard?: Rel<OptimalCardEntity> | null;

    @Property({ type: 'timestamptz', fieldName: 'closed_at', nullable: true })
    closedAt?: Date | null;
}
