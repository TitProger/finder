import { Entity, Property, Unique } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';

/**
 * Тарифный план (тариф).
 * Определяет лимиты и возможности для пользователей.
 */
@Entity({ tableName: 'plan' })
export class PlanEntity extends BaseEntity {
    @Property({ type: 'varchar', length: 50 })
    @Unique()
    code!: string;

    @Property({ type: 'varchar', length: 255 })
    title!: string;

    /**
     * Дневной лимит запросов на ресерч (null = безлимит).
     */
    @Property({ type: 'int', fieldName: 'daily_research_limit', nullable: true })
    dailyResearchLimit?: number | null;
}
