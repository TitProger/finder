import { Entity, Enum, ManyToOne, Property, Rel, Unique } from '@mikro-orm/core';

import { ContactChannel } from '../../enums/contact-channel.enum';
import { BaseEntity } from '../common/base.entity';
import { CanonicalProductEntity } from '../catalog/canonical-product.entity';
import { CompanyEntity } from '../catalog/company.entity';
import { OfferEntity } from '../catalog/offer.entity';
import { StorefrontEntity } from '../catalog/storefront.entity';
import { CategoryQuestionEntity } from '../category/category-question.entity';
import { CategoryEntity } from '../category/category.entity';
import { AppUserEntity } from '../user/app-user.entity';

@Entity({ tableName: 'optimal_card' })
@Unique({
    name: 'optimal_card_one_live_per_product_qty',
    expression:
        'create unique index "optimal_card_one_live_per_product_qty" on "optimal_card" ("canonical_product_id", "qty_min", "qty_max") where "is_live" = true',
})
export class OptimalCardEntity extends BaseEntity<'isLive' | 'contactAdminEntered'> {
    @ManyToOne(() => CategoryEntity, {
        fieldName: 'category_id',
        deleteRule: 'restrict',
    })
    category!: Rel<CategoryEntity>;

    @ManyToOne(() => CanonicalProductEntity, {
        fieldName: 'canonical_product_id',
        deleteRule: 'restrict',
    })
    canonicalProduct!: Rel<CanonicalProductEntity>;

    @Property({ type: 'numeric', fieldName: 'qty_min' })
    qtyMin!: string;

    @Property({ type: 'numeric', fieldName: 'qty_max' })
    qtyMax!: string;

    @ManyToOne(() => CategoryQuestionEntity, {
        fieldName: 'quantity_question_id',
        deleteRule: 'restrict',
    })
    quantityQuestion!: Rel<CategoryQuestionEntity>;

    @Property({ type: 'boolean', fieldName: 'is_live', default: false })
    isLive: boolean = false;

    @ManyToOne(() => OfferEntity, {
        fieldName: 'offer_id',
        deleteRule: 'set null',
        nullable: true,
    })
    offer?: Rel<OfferEntity> | null;

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

    @Property({ type: 'numeric', nullable: true })
    price?: string | null;

    @Property({ type: 'varchar', length: 3, nullable: true })
    currency?: string | null;

    @Property({ type: 'varchar', length: 512, fieldName: 'contact_value', nullable: true })
    contactValue?: string | null;

    @Enum({
        items: () => ContactChannel,
        nativeEnumName: 'contact_channel',
        fieldName: 'contact_channel',
        nullable: true,
    })
    contactChannel?: ContactChannel | null;

    @Property({ type: 'varchar', length: 2048, fieldName: 'contact_url', nullable: true })
    contactUrl?: string | null;

    @Property({ type: 'boolean', fieldName: 'contact_admin_entered', default: false })
    contactAdminEntered: boolean = false;

    @Property({ type: 'timestamptz', fieldName: 'contact_entered_at', nullable: true })
    contactEnteredAt?: Date | null;

    @Property({ type: 'jsonb', fieldName: 'product_attributes', nullable: true })
    productAttributes?: Record<string, unknown> | null;

    @Property({ type: 'text', fieldName: 'reason_note', nullable: true })
    reasonNote?: string | null;

    @ManyToOne(() => AppUserEntity, {
        fieldName: 'marked_live_by_user_id',
        deleteRule: 'set null',
        nullable: true,
    })
    markedLiveByUser?: Rel<AppUserEntity> | null;

    @Property({ type: 'timestamptz', fieldName: 'marked_live_at', nullable: true })
    markedLiveAt?: Date | null;

    @Property({ type: 'timestamptz', fieldName: 'expires_at', nullable: true })
    expiresAt?: Date | null;
}
