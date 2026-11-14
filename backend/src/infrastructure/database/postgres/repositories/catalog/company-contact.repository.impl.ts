import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { CompanyContactEntity } from '../../../../../domain/entities/catalog/company-contact.entity';
import { CompanyContactRepository as CompanyContactRepositoryPort } from '../../../../../domain/repositories/catalog/company-contact.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class CompanyContactRepositoryImpl
    extends BaseRepositoryImpl<CompanyContactEntity>
    implements CompanyContactRepositoryPort
{
    constructor(
        @InjectRepository(CompanyContactEntity)
        repository: BaseRepositoryImpl<CompanyContactEntity>,
    ) {
        super(repository.getEntityManager(), CompanyContactEntity);
    }
}
