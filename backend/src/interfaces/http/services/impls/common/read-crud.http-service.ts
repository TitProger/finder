import { ListQuery, ListResult } from '../../../../../application/common/list-query';
import { CrudService } from '../../../../../application/services/contracts/common/crud.service';
import { ServiceResult } from '../../../common/service-result.interface';
import { EntityMapper } from '../../../mappers/common/entity-mapper.interface';
import { ReadCrudHttpService } from '../../contracts/common/read-crud-http-service.interface';
import { AppMessages } from '@/application/messages';
import { PersistableEntity } from '@/domain/repositories/common/base.repository';

/**
 * Базовый read-only HTTP-сервис: application CrudService + EntityMapper.
 *
 * Для DTO со связями наследник передаёт populate явно
 * (`list(query, { populate: X_POPULATE.FULL })`) или зовёт `*WithDetails`.
 */
export abstract class ReadCrudHttpServiceImpl<
    TEntity extends PersistableEntity,
    TDto,
    TQuery extends ListQuery = ListQuery,
    TApplicationService extends CrudService<TEntity, TQuery, any, any> = CrudService<TEntity, TQuery>,
> implements ReadCrudHttpService<TDto, TQuery> {
    constructor(
        protected readonly service: TApplicationService,
        protected readonly mapper: EntityMapper<TEntity, TDto>,
    ) {}

    /** Пагинированный список DTO. */
    async list(query: TQuery): Promise<ServiceResult<TDto[]>> {
        const result: ListResult<TEntity> = await this.service.list(query);

        return this.toListResult(result);
    }

    /** DTO по id. */
    async getById(id: string): Promise<ServiceResult<TDto>> {
        const entity = await this.service.getById(id);

        return this.ok(this.mapper.toDto(entity), AppMessages.common.fetched);
    }

    /** Успешный ответ с сообщением. */
    protected ok<T>(data: T, message: string, extra?: Omit<ServiceResult<T>, 'data' | 'message'>): ServiceResult<T> {
        return { data, message, ...extra };
    }

    /** Собирает ServiceResult списка с page. */
    protected toListResult(
        result: ListResult<TEntity>,
        message: string = AppMessages.common.listed,
    ): ServiceResult<TDto[]> {
        return this.ok(this.mapper.toDtoList(result.items), message, {
            page: {
                page: result.page,
                limit: result.limit,
                total: result.total,
            },
        });
    }
}
