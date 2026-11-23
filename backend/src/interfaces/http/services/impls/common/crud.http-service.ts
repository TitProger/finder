import { ListQuery } from '../../../../../application/common/list-query';
import { AppMessages } from '../../../../../application/messages';
import { CrudService } from '../../../../../application/services/contracts/common/crud.service';
import { PersistableEntity } from '../../../../../domain/repositories/common/base.repository';
import { ServiceResult } from '../../../common/service-result.interface';
import { EntityMapper } from '../../../mappers/common/entity-mapper.interface';
import { CrudHttpService } from '../../contracts/common/crud-http-service.interface';
import { ReadCrudHttpServiceImpl } from './read-crud.http-service';

/**
 * Полный HTTP CRUD-сервис: read из {@link ReadCrudHttpServiceImpl} + create/update/delete.
 * Проверка ролей сюда не входит: доступ задаёт контроллер конкретной ручки.
 */
export abstract class CrudHttpServiceImpl<
    TEntity extends PersistableEntity,
    TDto,
    TQuery extends ListQuery = ListQuery,
    TApplicationService extends CrudService<TEntity, TQuery, any, any> = CrudService<TEntity, TQuery>,
    TCreateDto = Partial<TDto>,
    TUpdateDto = Partial<TDto>,
>
    extends ReadCrudHttpServiceImpl<TEntity, TDto, TQuery, TApplicationService>
    implements CrudHttpService<TDto, TCreateDto, TUpdateDto, TQuery>
{
    constructor(service: TApplicationService, mapper: EntityMapper<TEntity, TDto>) {
        super(service, mapper);
    }

    async create(dto: TCreateDto): Promise<ServiceResult<TDto>> {
        const entity = await this.service.create(dto);

        return this.ok(this.mapper.toDto(entity), AppMessages.common.created);
    }

    async update(id: string, dto: TUpdateDto): Promise<ServiceResult<TDto>> {
        const entity = await this.service.update(id, dto);

        return this.ok(this.mapper.toDto(entity), AppMessages.common.updated);
    }

    async patch(id: string, dto: TUpdateDto): Promise<ServiceResult<TDto>> {
        const entity = await this.service.patch(id, dto);

        return this.ok(this.mapper.toDto(entity), AppMessages.common.updated);
    }

    async delete(id: string): Promise<ServiceResult<{ id: string }>> {
        const result = await this.service.delete(id);

        return this.ok(result, AppMessages.common.deleted);
    }
}
