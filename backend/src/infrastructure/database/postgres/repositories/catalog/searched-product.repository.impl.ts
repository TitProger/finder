import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { SearchedProductEntity } from '../../../../../domain/entities/catalog/searched-product.entity';
import { SearchedProductRepository as SearchedProductRepositoryPort } from '../../../../../domain/repositories/catalog/searched-product.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class SearchedProductRepositoryImpl
    extends BaseRepositoryImpl<SearchedProductEntity>
    implements SearchedProductRepositoryPort
{
    constructor(
        @InjectRepository(SearchedProductEntity)
        repository: BaseRepositoryImpl<SearchedProductEntity>,
    ) {
        super(repository.getEntityManager(), SearchedProductEntity);
    }
}
