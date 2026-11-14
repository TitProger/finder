import { Entity, Enum, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { SiteRole } from '../../enums/site-role.enum';
import { BaseEntity } from '../common/base.entity';
import { CategoryEntity } from './category.entity';

@Entity({ tableName: 'category_site' })
export class CategorySiteEntity extends BaseEntity<'priority' | 'requiresLogin' | 'isActive'> {
    @ManyToOne(() => CategoryEntity, {
        fieldName: 'category_id',
        deleteRule: 'cascade',
    })
    category!: Rel<CategoryEntity>;

    @Enum({ items: () => SiteRole, nativeEnumName: 'site_role', fieldName: 'site_role' })
    siteRole!: SiteRole;

    @Property({ type: 'varchar', length: 255 })
    name!: string;

    @Property({ type: 'varchar', length: 2048, fieldName: 'base_url', nullable: true })
    baseUrl?: string | null;

    @Property({ type: 'int', default: 100 })
    priority: number = 100;

    @Property({ type: 'boolean', fieldName: 'requires_login', default: false })
    requiresLogin: boolean = false;

    @Property({ type: 'text', fieldName: 'query_template', nullable: true })
    queryTemplate?: string | null;

    @Property({ type: 'text', fieldName: 'exclude_note', nullable: true })
    excludeNote?: string | null;

    @Property({ type: 'boolean', fieldName: 'is_active', default: true })
    isActive: boolean = true;
}
