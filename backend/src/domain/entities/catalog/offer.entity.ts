import { Entity, Enum, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { SupplierRole } from '../../enums/supplier-role.enum';
import { BaseEntity } from '../common/base.entity';
import { CategorySiteEntity } from '../category/category-site.entity';
import { ResearchRunEntity } from '../market/research-run.entity';
import { CanonicalProductEntity } from './canonical-product.entity';
import { CompanyEntity } from './company.entity';
import { StorefrontEntity } from './storefront.entity';

@Entity({ tableName: 'offer' })
export class OfferEntity extends BaseEntity<'supplierRole'> {
    @ManyToOne(() => ResearchRunEntity, {
        fieldName: 'research_run_id',
        deleteRule: 'set null',
        nullable: true,
    })
    researchRun?: Rel<ResearchRunEntity> | null;

    @ManyToOne(() => CanonicalProductEntity, {
        fieldName: 'canonical_product_id',
        deleteRule: 'set null',
        nullable: true,
    })
    canonicalProduct?: Rel<CanonicalProductEntity> | null;

    @ManyToOne(() => CompanyEntity, {
        fieldName: 'company_id',
        deleteRule: 'set null',
        nullable: true,
    })
    company?: Rel<CompanyEntity> | null;

    @ManyToOne(() => StorefrontEntity, {
        fieldName: 'storefront_id',
        deleteRule: 'set null',
        nullable: true,
    })
    storefront?: Rel<StorefrontEntity> | null;

    @ManyToOne(() => CategorySiteEntity, {
        fieldName: 'category_site_id',
        deleteRule: 'set null',
        nullable: true,
    })
    categorySite?: Rel<CategorySiteEntity> | null;

    @Property({ type: 'varchar', length: 2048, fieldName: 'source_url' })
    sourceUrl!: string;

    @Property({ type: 'numeric', nullable: true })
    price?: string | null;

    @Property({ type: 'varchar', length: 3, nullable: true })
    currency?: string | null;

    @Property({ type: 'text', fieldName: 'volume_tier', nullable: true })
    volumeTier?: string | null;

    @Property({ type: 'numeric', nullable: true })
    moq?: string | null;

    @Property({ type: 'text', fieldName: 'quote_text', nullable: true })
    quoteText?: string | null;

    @Enum({
        items: () => SupplierRole,
        nativeEnumName: 'supplier_role',
        fieldName: 'supplier_role',
        default: SupplierRole.UNVERIFIED,
    })
    supplierRole: SupplierRole = SupplierRole.UNVERIFIED;

    @Property({ type: 'timestamptz', fieldName: 'captured_at' })
    capturedAt!: Date;

    @Property({ type: 'timestamptz', fieldName: 'expires_at', nullable: true })
    expiresAt?: Date | null;
}
