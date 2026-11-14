import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { CompanyEntity } from '../../../../../domain/entities/catalog/company.entity';
import { CompanyRepository as CompanyRepositoryPort } from '../../../../../domain/repositories/catalog/company.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class CompanyRepositoryImpl extends BaseRepositoryImpl<CompanyEntity> implements CompanyRepositoryPort {
    constructor(
        @InjectRepository(CompanyEntity)
        repository: BaseRepositoryImpl<CompanyEntity>,
    ) {
        super(repository.getEntityManager(), CompanyEntity);
    }
}
