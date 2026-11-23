import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { SearchedProductQuery } from '@/application/services/impls/product/searched-product.service';
import type { ProductListItem } from '../../generated/responses/products';
import { Public } from '../../auth/public.decorator';
import { SearchedProductHttpService } from '../../services/impls/product/searched-product.http-service';
import { ReadCrudControllerImpl } from '../common/read-crud/read-crud.controller';

/**
 * История и карточка. Публичные: до пакета входа поиск открывается без токена.
 */
@Public()
@Controller('products')
export class SearchedProductController extends ReadCrudControllerImpl<
    ProductListItem,
    SearchedProductQuery,
    SearchedProductHttpService
> {
    constructor(httpService: SearchedProductHttpService) {
        super(httpService);
    }

    @Public()
    @Get()
    override async list(@Query() query: SearchedProductQuery) {
        return this.httpService.list(query);
    }

    @Public()
    @Get(':id')
    override async getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.httpService.getById(id);
    }
}
