import { EntityManager, EntityName, FilterQuery, Populate } from '@mikro-orm/core';

import {
    CrudServiceErrors,
    FindByFilterOptions,
    GetByFilterOptions,
    GetByIdOptions,
    GetWithOptions,
    PersistOptions,
} from '../../../contracts/common/crud.service';
import { EntityReadService } from '../../../contracts/common/entity-read.service';
import { ListQuery, ListResult } from '@/application/common/list-query';
import { normalizePagination } from '@/application/common/pagination.helper';
import { parseSort } from '@/application/common/parse-sort';
import {
    resolveEntityManager as resolveEntityManagerHelper,
    resolvePersistOptions as resolvePersistOptionsHelper,
} from '@/application/common/resolve-persist-options.helper';
import { AppErrors } from '@/application/errors';
import { CommonErrors } from '@/application/errors/common.errors';
import { BadRequestAppException } from '@/common/exceptions/bad-request.exception';
import { NotFoundAppException } from '@/common/exceptions/not-found.exception';
import { BaseRepository, PersistableEntity } from '@/domain/repositories/common/base.repository';

/**
 * Общая read-логика (getById, findByFilter, …) + {@link resolvePersistOptions}.
 * Мягко удалённые строки отсекает фильтр `softDelete` на `BaseAuditEntity`.
 */
export class EntityReadServiceImpl<
    TEntity extends PersistableEntity,
    TRepository extends BaseRepository<TEntity>,
    TQuery extends ListQuery = ListQuery,
> implements EntityReadService<TEntity, TQuery> {
    protected readonly errors: CrudServiceErrors = {
        notFound: AppErrors.common.notFound,
    };

    /** Populate для `getByIdWithDetails` (переопределяй в наследнике). */
    protected readonly detailPopulate?: readonly string[];

    constructor(protected readonly repository: TRepository) {}

    /**
     * EM и флаг flush из {@link PersistOptions}.
     * Наследники: `const { em, shouldFlush } = this.resolvePersistOptions(options)`.
     * Реализация — {@link resolvePersistOptionsHelper}.
     */
    protected resolvePersistOptions(options?: PersistOptions): {
        em: EntityManager;
        shouldFlush: boolean;
    } {
        return resolvePersistOptionsHelper(options, this.repository.getEntityManager());
    }

    protected resolveEntityManager(em?: EntityManager): EntityManager {
        return resolveEntityManagerHelper(em, this.repository.getEntityManager());
    }

    async list<Hint extends string = never>(
        query?: TQuery,
        options?: { populate?: Populate<TEntity, Hint> | readonly string[] },
    ): Promise<ListResult<TEntity>> {
        const safeQuery = query ?? ({} as TQuery);
        const { page, limit, offset } = normalizePagination(safeQuery);
        const orderBy = parseSort(safeQuery.sort);
        const where = this.buildListWhere(safeQuery);

        const [items, total] = await this.repository.findAndCount(where, {
            limit,
            offset,
            orderBy: orderBy as never,
            populate: options?.populate as Populate<TEntity, Hint> | undefined,
        });

        return { items, page, limit, total };
    }

    async listWithDetails(query: TQuery): Promise<ListResult<TEntity>> {
        return this.list(query, {
            populate: this.detailPopulate,
        });
    }

    async findByFilter(where: FilterQuery<TEntity>, options?: FindByFilterOptions<TEntity>): Promise<TEntity | null> {
        this.ensureFilterIsNotEmpty(where);

        const em = options?.em ?? this.repository.getEntityManager();

        return em.findOne(this.repository.getEntityName() as EntityName<TEntity>, where, {
            populate: options?.populate as Populate<TEntity> | undefined,
        });
    }

    async findMany(where: FilterQuery<TEntity>, options?: FindByFilterOptions<TEntity>): Promise<TEntity[]> {
        this.ensureFilterIsNotEmpty(where);

        const em = options?.em ?? this.repository.getEntityManager();

        return em.find(this.repository.getEntityName() as EntityName<TEntity>, where, {
            populate: options?.populate as Populate<TEntity> | undefined,
        });
    }

    async getMany(where: FilterQuery<TEntity>, options?: GetByFilterOptions<TEntity>): Promise<TEntity[]> {
        const entities = await this.findMany(where, options);

        if (entities.length === 0) {
            throw new NotFoundAppException(options?.error?.message ?? this.errors.notFound.message, {
                code: options?.error?.code ?? this.errors.notFound.code,
                details: options?.error?.details ?? where,
            });
        }

        return entities;
    }

    async getByFilter(where: FilterQuery<TEntity>, options?: GetByFilterOptions<TEntity>): Promise<TEntity> {
        const entity = await this.findByFilter(where, options);

        if (!entity) {
            throw new NotFoundAppException(options?.error?.message ?? this.errors.notFound.message, {
                code: options?.error?.code ?? this.errors.notFound.code,
                details: options?.error?.details ?? where,
            });
        }

        return entity;
    }

    async existsByFilter(filters: Record<string, unknown>): Promise<boolean> {
        this.ensureFilterIsNotEmpty(filters);

        return this.repository.existsByFilter(filters);
    }

    async getById<Hint extends string = never>(
        id: string,
        options?: GetByIdOptions<TEntity> & { populate?: Populate<TEntity, Hint> | readonly string[] },
    ): Promise<TEntity> {
        return this.getByFilter({ id } as FilterQuery<TEntity>, {
            ...options,
            error: {
                message: options?.error?.message ?? `${this.errors.notFound.message} [ID: ${id}]`,
                code: options?.error?.code,
                details: options?.error?.details ?? { id },
            },
        });
    }

    async findById(id: string, em?: EntityManager): Promise<TEntity | null> {
        return this.findByFilter({ id } as FilterQuery<TEntity>, { em });
    }

    async getByIdWithDetails(id: string, options?: GetWithOptions): Promise<TEntity> {
        return this.getById(id, {
            populate: this.detailPopulate,
            error: options?.error,
            em: options?.em,
        });
    }

    /**
     * Фильтры list: всё из query, кроме page/limit/sort.
     * Переопределяй в наследнике для `$ilike` и сложных условий.
     */
    protected buildListWhere(query: TQuery): FilterQuery<TEntity> {
        const { page: _page, limit: _limit, sort: _sort, ...rawFilters } = query as TQuery & ListQuery;

        return Object.fromEntries(
            Object.entries(rawFilters).filter(([, value]) => value !== undefined && value !== ''),
        ) as FilterQuery<TEntity>;
    }

    private ensureFilterIsNotEmpty(filters?: FilterQuery<TEntity> | Record<string, unknown>): void {
        if (!filters || Object.keys(filters).length === 0) {
            throw new BadRequestAppException(CommonErrors.emptyFilter.message, {
                code: CommonErrors.emptyFilter.code,
            });
        }
    }
}
