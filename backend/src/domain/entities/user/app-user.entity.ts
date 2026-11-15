import { BigIntType, Entity, Enum, Property, Unique } from '@mikro-orm/core';

import { UserRole } from '../../enums/user-role.enum';
import { BaseEntity } from '../common/base.entity';

@Entity({ tableName: 'app_user' })
export class AppUserEntity extends BaseEntity<'isActive'> {
    @Enum({ items: () => UserRole, nativeEnumName: 'user_role' })
    role!: UserRole;

    /**
     * Колонка bigint. `string | null` в reflect-metadata стирается в Object,
     * и дефолтный BigIntType тогда отдаёт native bigint. `!== String(id)` из апдейта
     * отклоняет владельца заявки.
     */
    @Property({ type: new BigIntType('string'), fieldName: 'telegram_user_id', nullable: true })
    @Unique()
    telegramUserId?: string | null;

    @Property({ type: 'varchar', length: 255, fieldName: 'display_name', nullable: true })
    displayName?: string | null;

    @Property({ type: 'boolean', fieldName: 'is_active', default: true })
    isActive: boolean = true;

    /**
     * Код тарифного плана (например, 'free', 'unlimited').
     * По умолчанию 'free'.
     */
    @Property({ type: 'varchar', length: 50, fieldName: 'plan_code', default: 'free' })
    planCode: string = 'free';
}
