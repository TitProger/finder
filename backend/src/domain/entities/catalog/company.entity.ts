import { Entity, Enum, Property, Unique } from '@mikro-orm/core';

import { CompanyRegistryStatus } from '../../enums/company-registry-status.enum';
import { SupplierRole } from '../../enums/supplier-role.enum';
import { BaseEntity } from '../common/base.entity';

@Entity({ tableName: 'company' })
export class CompanyEntity extends BaseEntity<'registryStatus'> {
    @Property({ type: 'varchar', length: 512, fieldName: 'legal_name_zh' })
    legalNameZh!: string;

    @Property({ type: 'varchar', length: 512, nullable: true })
    name?: string | null;

    @Enum({
        items: () => SupplierRole,
        nativeEnumName: 'supplier_role',
        nullable: true,
    })
    role?: SupplierRole | null;

    @Property({ type: 'json', fieldName: 'role_evidence', nullable: true })
    roleEvidence?: string[] | null;

    @Property({ type: 'varchar', length: 32, fieldName: 'unified_social_credit_code', nullable: true })
    @Unique()
    unifiedSocialCreditCode?: string | null;

    @Enum({
        items: () => CompanyRegistryStatus,
        nativeEnumName: 'company_registry_status',
        fieldName: 'registry_status',
        default: CompanyRegistryStatus.UNKNOWN,
    })
    registryStatus: CompanyRegistryStatus = CompanyRegistryStatus.UNKNOWN;

    @Property({ type: 'text', nullable: true })
    address?: string | null;

    @Property({ type: 'text', fieldName: 'business_scope', nullable: true })
    businessScope?: string | null;

    @Property({ type: 'int', fieldName: 'insured_employee_count', nullable: true })
    insuredEmployeeCount?: number | null;
}
