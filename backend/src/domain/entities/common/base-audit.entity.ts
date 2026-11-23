import { Entity, Filter, OptionalProps, Property } from '@mikro-orm/core';

/**
 * Audit-поля и фильтр soft-delete для новых CRUD-сущностей.
 * Выборы ORM не возвращают строки с `deleted_at`.
 * Существующий `BaseEntity` Finder этот класс не наследует.
 */
@Entity({ abstract: true })
@Filter({
    name: 'softDelete',
    cond: { deletedAt: null },
    default: true,
})
export abstract class BaseAuditEntity<Optional extends string = never> {
    [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt' | Optional;

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

    @Property({
        type: 'timestamptz',
        fieldName: 'deleted_at',
        nullable: true,
    })
    deletedAt: Date | null = null;
}
