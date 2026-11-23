import { Entity, Enum, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { ResearchTaskStatus } from '../../enums/research-task-status.enum';
import { BaseEntity } from '../common/base.entity';
import { InquiryEntity } from '../inquiry/inquiry.entity';
import { ResearchRunEntity } from './research-run.entity';

/**
 * Очередь ресерча на Postgres. Redis не используется.
 * Worker забирает PENDING и зовёт асинхронный мост; 2xx триггера — «запуск принят».
 */
@Entity({ tableName: 'research_task' })
export class ResearchTaskEntity extends BaseEntity<'status' | 'attempts'> {
    @ManyToOne(() => InquiryEntity, {
        fieldName: 'inquiry_id',
        deleteRule: 'cascade',
    })
    inquiry!: Rel<InquiryEntity>;

    @ManyToOne(() => ResearchRunEntity, {
        fieldName: 'research_run_id',
        deleteRule: 'set null',
        nullable: true,
    })
    researchRun?: Rel<ResearchRunEntity> | null;

    @Enum({
        items: () => ResearchTaskStatus,
        nativeEnumName: 'research_task_status',
        default: ResearchTaskStatus.PENDING,
    })
    status: ResearchTaskStatus = ResearchTaskStatus.PENDING;

    @Property({ type: 'int', default: 0 })
    attempts: number = 0;

    @Property({ type: 'text', fieldName: 'last_error', nullable: true })
    lastError?: string | null;

    @Property({ type: 'timestamptz', fieldName: 'claimed_at', nullable: true })
    claimedAt?: Date | null;

    @Property({ type: 'timestamptz', fieldName: 'finished_at', nullable: true })
    finishedAt?: Date | null;
}
