import { ListQuery } from '../../../../../application/common/list-query';
import { ReadCrudHttpService } from './read-crud-http-service.interface';
import { WriteCrudHttpService } from './write-crud-http-service.interface';

/** Полный HTTP CRUD-сервис. */
export interface CrudHttpService<
    TDto,
    TCreateDto = Partial<TDto>,
    TUpdateDto = Partial<TDto>,
    TQuery extends ListQuery = ListQuery,
>
    extends ReadCrudHttpService<TDto, TQuery>, WriteCrudHttpService<TDto, TCreateDto, TUpdateDto> {}
