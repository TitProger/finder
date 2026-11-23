import { Injectable } from '@nestjs/common';

import { AppMessages } from '@/application/messages';
import { SearchedProductService, SearchedProductQuery } from '@/application/services/impls/product/searched-product.service';
import { SearchedProductEntity } from '@/domain/entities/catalog/searched-product.entity';
import type { ProductCard, ProductListItem } from '../../../generated/responses/products';
import { ServiceResult } from '../../../common/service-result.interface';
import { SearchedProductMapper } from '../../../mappers/product/searched-product.mapper';
import { ReadCrudHttpServiceImpl } from '../common/read-crud.http-service';

@Injectable()
export class SearchedProductHttpService extends ReadCrudHttpServiceImpl<
    SearchedProductEntity,
    ProductListItem,
    SearchedProductQuery,
    SearchedProductService
> {
    constructor(
        service: SearchedProductService,
        private readonly productMapper: SearchedProductMapper,
    ) {
        super(service, productMapper);
    }

    override async getById(id: string): Promise<ServiceResult<ProductCard>> {
        const entity = await this.service.getById(id);

        return this.ok(this.productMapper.toCard(entity), AppMessages.common.fetched);
    }
}
