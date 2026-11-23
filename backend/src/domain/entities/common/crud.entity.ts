import { randomUUID } from 'crypto';
import { Entity, PrimaryKey } from '@mikro-orm/core';

import { BaseAuditEntity } from './base-audit.entity';

/**
 * База новых CRUD-ресурсов: PK и soft-delete.
 * Текущие сущности Finder остаются на `BaseEntity` и сюда не переводятся.
 */
@Entity({ abstract: true })
export abstract class CrudEntity<Optional extends string = never> extends BaseAuditEntity<Optional> {
    @PrimaryKey({ type: 'uuid' })
    readonly id: string = randomUUID();
}
