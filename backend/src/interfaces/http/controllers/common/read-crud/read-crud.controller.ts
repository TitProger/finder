import { Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { ListQuery } from '../../../../../application/common/list-query';
import { ReadCrudHttpService } from '../../../services/contracts/common/read-crud-http-service.interface';
import { ReadCrudController } from './read-crud-controller.interface';

/**
 * Базовый read-only HTTP-контроллер (Contract First: list + getById).
 *
 * - Валидация query/path — AJV по OpenAPI
 * - Ответ — ServiceResult; envelope собирает ApiResponseInterceptor
 */
export abstract class ReadCrudControllerImpl<
    TDto,
    TQuery extends ListQuery = ListQuery,
    THttpService extends ReadCrudHttpService<TDto, TQuery> = ReadCrudHttpService<TDto, TQuery>,
> implements ReadCrudController<TDto, TQuery> {
    constructor(public readonly httpService: THttpService) {}

    @Get()
    async list(@Query() query: TQuery) {
        return this.httpService.list(query);
    }

    @Get(':id')
    async getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.httpService.getById(id);
    }
}
