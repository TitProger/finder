import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { CanonicalProductEntity } from '../../../../../domain/entities/catalog/canonical-product.entity';
import { CanonicalProductRepository as CanonicalProductRepositoryPort } from '../../../../../domain/repositories/catalog/canonical-product.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class CanonicalProductRepositoryImpl
    extends BaseRepositoryImpl<CanonicalProductEntity>
    implements CanonicalProductRepositoryPort
{
    constructor(
        @InjectRepository(CanonicalProductEntity)
        repository: BaseRepositoryImpl<CanonicalProductEntity>,
    ) {
        super(repository.getEntityManager(), CanonicalProductEntity);
    }
}
