import { ListQuery } from '../../../../../application/common/list-query';
import { ServiceResult } from '../../../common/service-result.interface';
import { CrudHttpService } from '../../../services/contracts/common/crud-http-service.interface';
import { WriteCrudHttpService } from '../../../services/contracts/common/write-crud-http-service.interface';
import { ReadCrudController } from '../read-crud/read-crud-controller.interface';

/** Контракт write-CRUD контроллера (create + update + delete). */
export interface WriteCrudController<TDto, TCreateDto = Partial<TDto>, TUpdateDto = Partial<TDto>> {
    readonly httpService: WriteCrudHttpService<TDto, TCreateDto, TUpdateDto>;

    create(dto: TCreateDto): Promise<ServiceResult<TDto>>;
    update(id: string, dto: TUpdateDto): Promise<ServiceResult<TDto>>;
    delete(id: string): Promise<ServiceResult<{ id: string }>>;
}

/** Полный CRUD-контракт контроллера. */
export interface CrudController<
    TDto,
    TCreateDto = Partial<TDto>,
    TUpdateDto = Partial<TDto>,
    TQuery extends ListQuery = ListQuery,
>
    extends ReadCrudController<TDto, TQuery>, WriteCrudController<TDto, TCreateDto, TUpdateDto> {
    readonly httpService: CrudHttpService<TDto, TCreateDto, TUpdateDto, TQuery>;
}
