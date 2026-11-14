import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';
import { InquiryEntity } from '../inquiry/inquiry.entity';
import { OptimalCardEntity } from './optimal-card.entity';

@Entity({ tableName: 'manual_economics' })
export class ManualEconomicsEntity extends BaseEntity {
    @ManyToOne(() => InquiryEntity, {
        fieldName: 'inquiry_id',
        deleteRule: 'cascade',
        unique: true,
    })
    inquiry!: Rel<InquiryEntity>;

    @ManyToOne(() => OptimalCardEntity, {
        fieldName: 'optimal_card_id',
        deleteRule: 'set null',
        nullable: true,
    })
    optimalCard?: Rel<OptimalCardEntity> | null;

    @Property({ type: 'numeric', fieldName: 'fx_rate', nullable: true })
    fxRate?: string | null;

    @Property({ type: 'numeric', fieldName: 'logistics_cost', nullable: true })
    logisticsCost?: string | null;

    /** Процент пошлины от цены товара. Сумма в рублях лежит в dutyCost. */
    @Property({ type: 'numeric', fieldName: 'duty_percent', nullable: true })
    dutyPercent?: string | null;

    @Property({ type: 'numeric', fieldName: 'duty_cost', nullable: true })
    dutyCost?: string | null;

    /** Прочие затраты за единицу, в рублях. */
    @Property({ type: 'numeric', fieldName: 'other_cost', nullable: true })
    otherCost?: string | null;

    /** Процент наценки. Сумма в рублях лежит в markupAmount. */
    @Property({ type: 'numeric', fieldName: 'markup_percent', nullable: true })
    markupPercent?: string | null;

    @Property({ type: 'numeric', fieldName: 'markup_amount', nullable: true })
    markupAmount?: string | null;

    @Property({ type: 'numeric', fieldName: 'client_price', nullable: true })
    clientPrice?: string | null;

    @Property({ type: 'varchar', length: 3, nullable: true })
    currency?: string | null;

    @Property({ type: 'text', nullable: true })
    note?: string | null;
}
