import { Entity, Property } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';

/**
 * Строка книги ставок владельца. По умолчанию таблица пустая.
 */
@Entity({ tableName: 'logistics_rate' })
export class LogisticsRateEntity extends BaseEntity<'isActive' | 'minCharge' | 'transitDaysMin' | 'transitDaysMax' | 'included'> {
    @Property({ type: 'varchar', length: 64 })
    mode!: string;

    @Property({ type: 'varchar', length: 256 })
    label!: string;

    @Property({ type: 'varchar', length: 128, fieldName: 'origin_place' })
    originPlace!: string;

    @Property({ type: 'varchar', length: 128 })
    destination!: string;

    @Property({ type: 'varchar', length: 3 })
    currency!: string;

    @Property({ type: 'numeric', fieldName: 'price_per_kg' })
    pricePerKg!: string;

    @Property({ type: 'numeric', fieldName: 'fx_to_rub' })
    fxToRub!: string;

    @Property({ type: 'numeric', fieldName: 'min_charge', default: 0 })
    minCharge: string = '0';

    @Property({ type: 'int', fieldName: 'transit_days_min', default: 0 })
    transitDaysMin: number = 0;

    @Property({ type: 'int', fieldName: 'transit_days_max', default: 0 })
    transitDaysMax: number = 0;

    @Property({ type: 'jsonb', default: [] })
    included: string[] = [];

    @Property({ type: 'boolean', fieldName: 'is_active', default: true })
    isActive: boolean = true;
}
