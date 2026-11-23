import { ListQuery } from '../../../../../application/common/list-query';
import { ServiceResult } from '../../../common/service-result.interface';
import { ReadCrudHttpService } from '../../../services/contracts/common/read-crud-http-service.interface';

/** Контракт read-CRUD контроллера (list + getById). */
export interface ReadCrudController<TDto, TQuery extends ListQuery = ListQuery> {
    readonly httpService: ReadCrudHttpService<TDto, TQuery>;

    list(query: TQuery): Promise<ServiceResult<TDto[]>>;
    getById(id: string): Promise<ServiceResult<TDto>>;
}
