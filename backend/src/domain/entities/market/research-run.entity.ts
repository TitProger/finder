import { Entity, Enum, ManyToOne, Property, Rel, Unique } from '@mikro-orm/core';

import { ResearchRunStatus } from '../../enums/research-run-status.enum';
import { BaseEntity } from '../common/base.entity';
import { InquiryEntity } from '../inquiry/inquiry.entity';

export type StoredIngestResult = {
    counts: { companies: number; offers: number; contacts: number };
    discarded: { path: string; reason: string }[];
};

@Entity({ tableName: 'research_run' })
export class ResearchRunEntity extends BaseEntity<'status' | 'triggerAttempts'> {
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

    @Property({ type: 'uuid', fieldName: 'run_id', nullable: true })
    @Unique()
    runId?: string | null;

    @Property({ type: 'varchar', length: 16, fieldName: 'dossier_status', nullable: true })
    dossierStatus?: string | null;

    @Property({ type: 'json', nullable: true })
    sites?: unknown;

    @Property({ type: 'json', nullable: true })
    fx?: unknown;

    @Property({ type: 'text', fieldName: 'summary_ru', nullable: true })
    summaryRu?: string | null;

    @Property({ type: 'json', fieldName: 'raw_payload', nullable: true })
    rawPayload?: unknown;

    @Property({ type: 'varchar', length: 64, fieldName: 'payload_sha256', nullable: true })
    payloadSha256?: string | null;

    @Property({ type: 'json', nullable: true })
    discarded?: { path: string; reason: string }[] | null;

    @Property({ type: 'json', fieldName: 'ingest_result', nullable: true })
    ingestResult?: StoredIngestResult | null;

    @Property({ type: 'int', fieldName: 'trigger_attempts', default: 0 })
    triggerAttempts: number = 0;

    @Property({ type: 'text', fieldName: 'trigger_last_error', nullable: true })
    triggerLastError?: string | null;
}
