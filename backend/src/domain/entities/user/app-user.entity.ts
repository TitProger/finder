import { Entity, Enum, Property } from '@mikro-orm/core';

import { UserRole } from '../../enums/user-role.enum';
import { BaseEntity } from '../common/base.entity';

@Entity({ tableName: 'app_user' })
export class AppUserEntity extends BaseEntity<'isActive'> {
    @Enum({ items: () => UserRole, nativeEnumName: 'user_role' })
    role!: UserRole;

    @Property({ type: 'varchar', length: 255, fieldName: 'display_name', nullable: true })
    displayName?: string | null;

    @Property({ type: 'boolean', fieldName: 'is_active', default: true })
    isActive: boolean = true;
}
