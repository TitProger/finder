import { Entity, ManyToOne, Property, Rel, Unique } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';
import { CompanyEntity } from './company.entity';

@Entity({ tableName: 'storefront' })
@Unique({
    name: 'storefront_platform_seller_unique',
    expression:
        'create unique index "storefront_platform_seller_unique" on "storefront" ("platform_name", "seller_external_id") where "seller_external_id" is not null',
})
export class StorefrontEntity extends BaseEntity {
    @ManyToOne(() => CompanyEntity, {
        fieldName: 'company_id',
        deleteRule: 'set null',
        nullable: true,
    })
    company?: Rel<CompanyEntity> | null;

    @Property({ type: 'varchar', length: 128, fieldName: 'platform_name' })
    platformName!: string;

    @Property({ type: 'varchar', length: 255, fieldName: 'seller_external_id', nullable: true })
    sellerExternalId?: string | null;

    @Property({ type: 'varchar', length: 2048, fieldName: 'storefront_url' })
    storefrontUrl!: string;

    @Property({ type: 'jsonb', fieldName: 'factory_labels', nullable: true })
    factoryLabels?: unknown;

    @Property({ type: 'varchar', length: 255, nullable: true })
    city?: string | null;
}
