import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { CrudEntity } from '../common/crud.entity';
import { StoredFileEntity } from '../file/stored-file.entity';
import { SearchedProductDossier } from './searched-product.dossier';

/**
 * Товар истории поиска. Не канонический товар ресерча: это витрина экранов.
 */
@Entity({ tableName: 'searched_product' })
export class SearchedProductEntity extends CrudEntity {
    @Property({ type: 'varchar', length: 128, unique: true })
    slug!: string;

    @Property({ type: 'varchar', length: 512 })
    name!: string;

    @Property({ type: 'varchar', length: 255, fieldName: 'category_label' })
    categoryLabel!: string;

    @Property({ type: 'varchar', length: 64, fieldName: 'chip_label', nullable: true })
    chipLabel?: string | null;

    @Property({ type: 'int', fieldName: 'material_count' })
    materialCount!: number;

    @Property({ type: 'timestamptz', fieldName: 'searched_at' })
    searchedAt!: Date;

    @Property({ type: 'varchar', length: 64, nullable: true })
    article?: string | null;

    @ManyToOne(() => StoredFileEntity, {
        fieldName: 'cover_file_id',
        nullable: true,
        deleteRule: 'set null',
    })
    coverFile?: Rel<StoredFileEntity> | null;

    @Property({ type: 'json', nullable: true })
    dossier?: SearchedProductDossier | null;
}
