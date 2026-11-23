import { Entity, Property } from '@mikro-orm/core';

import { CrudEntity } from '../common/crud.entity';

/**
 * Один файл хранилища. Повтор того же storage_key не создаёт вторую строку.
 */
@Entity({ tableName: 'stored_file' })
export class StoredFileEntity extends CrudEntity {
    @Property({ type: 'varchar', length: 512, fieldName: 'storage_key', unique: true })
    storageKey!: string;

    @Property({ type: 'varchar', length: 128 })
    mime!: string;

    @Property({ type: 'int', fieldName: 'size_bytes' })
    sizeBytes!: number;
}
