import { Body, Delete, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';

import { ListQuery } from '../../../../../application/common/list-query';
import { CrudHttpService } from '../../../services/contracts/common/crud-http-service.interface';
import { ReadCrudControllerImpl } from '../read-crud/read-crud.controller';
import { CrudController } from './crud-controller.interface';

/**
 * Полный HTTP CRUD-контроллер: read из {@link ReadCrudControllerImpl} + create/update/delete.
 */
export abstract class CrudControllerImpl<
    TDto,
    TCreateDto = Partial<TDto>,
    TUpdateDto = Partial<TDto>,
    TQuery extends ListQuery = ListQuery,
    THttpService extends CrudHttpService<TDto, TCreateDto, TUpdateDto, TQuery> = CrudHttpService<
        TDto,
        TCreateDto,
        TUpdateDto,
        TQuery
    >,
>
    extends ReadCrudControllerImpl<TDto, TQuery, THttpService>
    implements CrudController<TDto, TCreateDto, TUpdateDto, TQuery>
{
    @Post()
    async create(@Body() dto: TCreateDto) {
        return this.httpService.create(dto);
    }

    @Put(':id')
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TUpdateDto) {
        return this.httpService.update(id, dto);
    }

    @Delete(':id')
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        return this.httpService.delete(id);
    }
}
