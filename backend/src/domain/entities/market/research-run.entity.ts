import { Entity, Enum, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { ResearchRunStatus } from '../../enums/research-run-status.enum';
import { BaseEntity } from '../common/base.entity';
import { InquiryEntity } from '../inquiry/inquiry.entity';

@Entity({ tableName: 'research_run' })
export class ResearchRunEntity extends BaseEntity<'status'> {
    @ManyToOne(() => InquiryEntity, {
        fieldName: 'inquiry_id',
        deleteRule: 'cascade',
    })
    inquiry!: Rel<InquiryEntity>;

    @Property({ type: 'varchar', length: 128 })
    source!: string;

    @Enum({
        items: () => ResearchRunStatus,
        nativeEnumName: 'research_run_status',
        default: ResearchRunStatus.PENDING,
    })
    status: ResearchRunStatus = ResearchRunStatus.PENDING;

    @Property({ type: 'varchar', length: 2048, fieldName: 'external_run_url', nullable: true })
    externalRunUrl?: string | null;

    @Property({ type: 'text', fieldName: 'failure_reason', nullable: true })
    failureReason?: string | null;

    @Property({ type: 'timestamptz', fieldName: 'started_at', nullable: true })
    startedAt?: Date | null;

    @Property({ type: 'timestamptz', fieldName: 'finished_at', nullable: true })
    finishedAt?: Date | null;
}
