import { Entity, Enum, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { MarketPriceLayer } from '../../enums/market-price-layer.enum';
import { BaseEntity } from '../common/base.entity';
import { CanonicalProductEntity } from '../catalog/canonical-product.entity';
import { InquiryEntity } from '../inquiry/inquiry.entity';
import { ResearchRunEntity } from './research-run.entity';

@Entity({ tableName: 'market_snapshot' })
export class MarketSnapshotEntity extends BaseEntity {
    @ManyToOne(() => ResearchRunEntity, {
        fieldName: 'research_run_id',
        deleteRule: 'set null',
        nullable: true,
    })
    researchRun?: Rel<ResearchRunEntity> | null;

    @ManyToOne(() => InquiryEntity, {
        fieldName: 'inquiry_id',
        deleteRule: 'set null',
        nullable: true,
    })
    inquiry?: Rel<InquiryEntity> | null;

    @ManyToOne(() => CanonicalProductEntity, {
        fieldName: 'canonical_product_id',
        deleteRule: 'set null',
        nullable: true,
    })
    canonicalProduct?: Rel<CanonicalProductEntity> | null;

    @Enum({ items: () => MarketPriceLayer, nativeEnumName: 'market_price_layer' })
    layer!: MarketPriceLayer;

    @Property({ type: 'varchar', length: 255 })
    source!: string;

    @Property({ type: 'numeric', fieldName: 'median_price', nullable: true })
    medianPrice?: string | null;

    @Property({ type: 'varchar', length: 3, nullable: true })
    currency?: string | null;

    @Property({ type: 'numeric', fieldName: 'spread_low', nullable: true })
    spreadLow?: string | null;

    @Property({ type: 'numeric', fieldName: 'spread_high', nullable: true })
    spreadHigh?: string | null;

    @Property({ type: 'jsonb', fieldName: 'sample_points', nullable: true })
    samplePoints?: unknown;

    @Property({ type: 'timestamptz', fieldName: 'captured_at' })
    capturedAt!: Date;

    @Property({ type: 'timestamptz', fieldName: 'expires_at' })
    expiresAt!: Date;
}
