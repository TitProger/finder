import { Entity, ManyToOne, Property, Rel } from '@mikro-orm/core';

import { BaseEntity } from '../common/base.entity';
import { CompanyEntity } from './company.entity';

@Entity({ tableName: 'company_contact' })
export class CompanyContactEntity extends BaseEntity {
    @ManyToOne(() => CompanyEntity, {
        fieldName: 'company_id',
        deleteRule: 'cascade',
    })
    company!: Rel<CompanyEntity>;

    @Property({ type: 'varchar', length: 16 })
    channel!: string;

    @Property({ type: 'text' })
    value!: string;

    @Property({ type: 'varchar', length: 2048, fieldName: 'source_url' })
    sourceUrl!: string;

    @Property({ type: 'timestamptz', fieldName: 'captured_at' })
    capturedAt!: Date;
}
