import { ListQuery } from '../../../../../application/common/list-query';
import { ServiceResult } from '../../../common/service-result.interface';

/** HTTP read-CRUD (list + getById). */
export interface ReadCrudHttpService<TDto, TQuery extends ListQuery = ListQuery> {
    list(query: TQuery): Promise<ServiceResult<TDto[]>>;
    getById(id: string): Promise<ServiceResult<TDto>>;
}
