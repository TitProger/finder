import { EntityManager, Populate } from '@mikro-orm/core';

import { ListQuery } from '../../../common/list-query';
import { EntityReadService } from './entity-read.service';
import { PersistableEntity } from '@/domain/repositories/common/base.repository';

/**
 * Application CRUD-сервис (без HTTP).
 * Read — {@link EntityReadService}; write — create / update / delete.
 *
 * `delete` — soft-delete (`deletedAt` на `CrudEntity`).
 * Сущности Finder на `BaseEntity` эту базу не наследуют.
 */
export interface CrudService<
    TEntity extends PersistableEntity,
    TQuery extends ListQuery = ListQuery,
    TCreateDto = Partial<TEntity>,
    TUpdateDto = Partial<TEntity>,
> extends EntityReadService<TEntity, TQuery> {
    /**
     * Создание сущности.
     *
     * @param dto — данные создания
     * @param options — см. {@link PersistOptions}
     */
    create(dto: TCreateDto, options?: PersistOptions): Promise<TEntity>;

    /**
     * Обновление сущности.
     *
     * @param id — id сущности
     * @param dto — поля для обновления
     * @param options — см. {@link PersistOptions}
     * @throws NotFoundAppException если сущность не найдена
     */
    update(id: string, dto: TUpdateDto, options?: PersistOptions): Promise<TEntity>;

    /**
     * Массовое обновление по списку id (как {@link update}).
     * Несуществующие id пропускаются — 404 не бросается.
     */
    updateMany(ids: string[], dto: TUpdateDto, options?: PersistOptions): Promise<BulkWriteResult<TEntity>>;

    /**
     * Soft-delete: проставляет `deletedAt`. Строка остаётся в БД.
     * Повторный вызов — 404 (фильтр `softDelete` скрывает уже удалённые).
     * Наследники могут запрещать (`409 Conflict`).
     *
     * @param id — id сущности
     * @param options — см. {@link PersistOptions}
     * @throws NotFoundAppException если сущность не найдена
     * @throws ConflictAppException если delete запрещён правилами сущности
     */
    delete(id: string, options?: PersistOptions): Promise<{ id: string }>;

    /**
     * Частичное обновление сущности.
     *
     * @param id — id сущности
     * @param dto — поля для обновления
     * @param options — см. {@link PersistOptions}
     * @throws NotFoundAppException если сущность не найдена
     */
    patch(id: string, dto: TUpdateDto, options?: PersistOptions): Promise<TEntity>;

    /**
     * Массовое частичное обновление по списку id (как {@link patch}).
     * Несуществующие id пропускаются — 404 не бросается.
     */
    patchMany(ids: string[], dto: TUpdateDto, options?: PersistOptions): Promise<BulkWriteResult<TEntity>>;
}

/**
 * Результат массового update/patch.
 *
 * - `matchedCount` — сколько сущностей нашлось по id
 * - `modifiedCount` — сколько реально изменились (dto отличался от текущих значений)
 * - `items` — все найденные сущности после операции (включая неизменившиеся)
 * - `missingIds` — запрошенные id, которых не оказалось в БД
 */
export type BulkWriteResult<TEntity> = {
    matchedCount: number;
    modifiedCount: number;
    items: TEntity[];
    missingIds: string[];
};

/**
 * Переопределение NotFound при `getById` / `getByFilter`
 * (fallback — `errors.notFound` сервиса).
 */
export interface GetByIdErrorOptions {
    message?: string;
    code?: string;
    details?: unknown;
}

export interface FindByFilterOptions<TEntity = unknown> {
    populate?: Populate<TEntity, string> | readonly string[];
    em?: EntityManager;
}

export interface GetByFilterOptions<TEntity = unknown> extends FindByFilterOptions<TEntity> {
    error?: GetByIdErrorOptions;
}

export type GetByIdOptions<TEntity = unknown> = GetByFilterOptions<TEntity>;

/** Options для `getWith*` / `getByIdWithDetails` (populate фиксирован). */
export type GetWithOptions = Pick<GetByIdOptions, 'error' | 'em'>;

/**
 * Options для `create` / `update` / `delete`.
 *
 * - `em` — fork из `transactional` (иначе EM репозитория)
 * - `flush` — сразу синхронизировать с БД (по умолчанию `true`); `false` — только persist
 */
export interface PersistOptions {
    em?: EntityManager;
    flush?: boolean;
}

export interface CrudServiceErrors {
    notFound: ServiceError;
}

export interface ServiceError {
    message: string;
    code: string;
}
