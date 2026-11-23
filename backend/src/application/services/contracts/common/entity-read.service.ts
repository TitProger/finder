import { EntityManager, FilterQuery, Populate } from '@mikro-orm/core';

import { FindByFilterOptions, GetByFilterOptions, GetByIdOptions, GetWithOptions } from './crud.service';
import { PersistableEntity } from '@/domain/repositories/common/base.repository';
import { ListQuery, ListResult } from '@/application/common/list-query';

/** Read-only application-сервис сущности. */
export interface EntityReadService<TEntity extends PersistableEntity, TQuery extends ListQuery = ListQuery> {
    /**
     * Пагинированный список; populate — только из `options`.
     *
     * @param query — фильтры + page / limit / sort
     * @param options.populate — связи для MikroORM (опционально)
     */
    list(
        query?: TQuery,
        options?: { populate?: Populate<TEntity, string> | readonly string[] },
    ): Promise<ListResult<TEntity>>;

    /**
     * Список с `detailPopulate` сервиса (если задан).
     *
     * @param query — фильтры + page / limit / sort
     */
    listWithDetails(query: TQuery): Promise<ListResult<TEntity>>;

    /**
     * Сущность по id.
     *
     * @param id — id сущности
     * @param options — populate / em / кастомный NotFound (см. {@link GetByIdOptions})
     * @throws NotFoundAppException если не найдена
     */
    getById(id: string, options?: GetByIdOptions<TEntity>): Promise<TEntity>;

    /**
     * Сущность по id или `null`.
     *
     * @param id — id сущности
     * @param em — fork из `transactional` (иначе EM репозитория)
     */
    findById(id: string, em?: EntityManager): Promise<TEntity | null>;

    /**
     * Сущность по фильтру или `null`.
     *
     * @param where — MikroORM filter
     * @param options — populate / em (см. {@link FindByFilterOptions})
     */
    findByFilter(where: FilterQuery<TEntity>, options?: FindByFilterOptions<TEntity>): Promise<TEntity | null>;

    /**
     * Все сущности по фильтру (без пагинации). Пара к {@link findByFilter}.
     * Для HTTP-списков — {@link list}; для TX / внутренних выборок — этот метод (`em` в options).
     *
     * @param where — MikroORM filter
     * @param options — populate / em (см. {@link FindByFilterOptions})
     */
    findMany(where: FilterQuery<TEntity>, options?: FindByFilterOptions<TEntity>): Promise<TEntity[]>;

    /**
     * Все сущности по фильтру (без пагинации). Пара к {@link findMany}.
     *
     * @param where — MikroORM filter
     * @param options — populate / em / кастомный NotFound (см. {@link GetByFilterOptions})
     * @throws NotFoundAppException если ни одной не найдено
     */
    getMany(where: FilterQuery<TEntity>, options?: GetByFilterOptions<TEntity>): Promise<TEntity[]>;

    /**
     * Сущность по фильтру.
     *
     * @param where — MikroORM filter
     * @param options — populate / em / кастомный NotFound (см. {@link GetByFilterOptions})
     * @throws NotFoundAppException если не найдена
     */
    getByFilter(where: FilterQuery<TEntity>, options?: GetByFilterOptions<TEntity>): Promise<TEntity>;

    /**
     * Есть ли хотя бы одна сущность по фильтру.
     *
     * @param filters — поля фильтра (как в репозитории)
     */
    existsByFilter(filters: Record<string, unknown>): Promise<boolean>;

    /**
     * Сущность по id с `detailPopulate` сервиса (если задан).
     *
     * @param id — id сущности
     * @param options — error / em (см. {@link GetWithOptions})
     * @throws NotFoundAppException если не найдена
     */
    getByIdWithDetails(id: string, options?: GetWithOptions): Promise<TEntity>;
}
