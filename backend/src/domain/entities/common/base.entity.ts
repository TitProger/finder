import { randomUUID } from 'crypto';
import { Entity, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Общий PK и audit-поля Finder. Soft-delete в BDM нет.
 */
@Entity({ abstract: true })
export abstract class BaseEntity<Optional extends string = never> {
    [OptionalProps]?: 'createdAt' | 'updatedAt' | Optional;

    @PrimaryKey({ type: 'uuid' })
    readonly id: string = randomUUID();

    @Property({
        type: 'timestamptz',
        fieldName: 'created_at',
        onCreate: () => new Date(),
        defaultRaw: 'NOW()',
    })
    createdAt!: Date;

    @Property({
        type: 'timestamptz',
        fieldName: 'updated_at',
        nullable: true,
        onUpdate: () => new Date(),
        defaultRaw: 'NOW()',
    })
    updatedAt!: Date | null;
}
