import { Entity, Enum, Property, Unique } from '@mikro-orm/core';

import { UserRole } from '../../enums/user-role.enum';
import { BaseEntity } from '../common/base.entity';

@Entity({ tableName: 'app_user' })
export class AppUserEntity extends BaseEntity<'isActive'> {
    @Enum({ items: () => UserRole, nativeEnumName: 'user_role' })
    role!: UserRole;

    @Property({ type: 'bigint', fieldName: 'telegram_user_id', nullable: true })
    @Unique()
    telegramUserId?: string | null;

    @Property({ type: 'varchar', length: 100, nullable: true })
    @Unique()
    login?: string | null;

    @Property({ type: 'varchar', length: 255, fieldName: 'password_hash', nullable: true })
    passwordHash?: string | null;

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
