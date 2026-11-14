import { Entity, ManyToOne, Property } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';
import { AppUserEntity } from '../user/app-user.entity';

/**
 * Использование дневного лимита пользователем.
 * Счётчик сбрасывается каждую полночь по московскому времени.
 */
@Entity({ tableName: 'daily_usage' })
export class DailyUsageEntity extends BaseEntity {
    @ManyToOne(() => AppUserEntity, { fieldName: 'user_id' })
    user!: AppUserEntity;

    /**
     * Дата (только день) в московском времени: YYYY-MM-DD.
     */
    @Property({ type: 'date', fieldName: 'usage_date' })
    usageDate!: string;

    /**
     * Количество запросов на ресерч за день.
     */
    @Property({ type: 'int', fieldName: 'research_count', default: 0 })
    researchCount: number = 0;
}
