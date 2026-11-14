import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { StorefrontEntity } from '../../../../../domain/entities/catalog/storefront.entity';
import { StorefrontRepository as StorefrontRepositoryPort } from '../../../../../domain/repositories/catalog/storefront.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class StorefrontRepositoryImpl extends BaseRepositoryImpl<StorefrontEntity> implements StorefrontRepositoryPort {
    constructor(
        @InjectRepository(StorefrontEntity)
        repository: BaseRepositoryImpl<StorefrontEntity>,
    ) {
        super(repository.getEntityManager(), StorefrontEntity);
    }
}
