import { EntityManager, EntityName, FilterQuery } from '@mikro-orm/core';

import { CrudEntity } from '../../../../../domain/entities/common/crud.entity';
import { BaseRepository } from '../../../../../domain/repositories/common/base.repository';
import { ListQuery } from '../../../../common/list-query';
import { BulkWriteResult, CrudService, PersistOptions } from '../../../contracts/common/crud.service';
import { EntityReadServiceImpl } from '../entity-read/entity-read.service.impl';

/**
 * Базовый CRUD поверх репозитория.
 * Populate-семантика — в {@link CrudService}; здесь — wiring к MikroORM.
 */
export class CrudServiceImpl<
    TEntity extends CrudEntity<string>,
    TRepository extends BaseRepository<TEntity>,
    TQuery extends ListQuery = ListQuery,
    TCreateDto = Partial<TEntity>,
    TUpdateDto = Partial<TEntity>,
>
    extends EntityReadServiceImpl<TEntity, TRepository, TQuery>
    implements CrudService<TEntity, TQuery, TCreateDto, TUpdateDto>
{
    async create(dto: TCreateDto, options?: PersistOptions): Promise<TEntity> {
        const { em, shouldFlush } = this.resolvePersistOptions(options);
        const entity = em.create(this.repository.getEntityName() as EntityName<TEntity>, dto as never);

        em.persist(entity);

        if (shouldFlush) {
            await em.flush();
        }

        return entity;
    }

    async update(id: string, dto: TUpdateDto, options?: PersistOptions): Promise<TEntity> {
        const { em, shouldFlush } = this.resolvePersistOptions(options);
        const entity = await this.getById(id, { em });

        em.assign(entity, dto as never);
        em.persist(entity);

        if (shouldFlush) {
            await em.flush();
        }

        return entity;
    }

    async updateMany(ids: string[], dto: TUpdateDto, options?: PersistOptions): Promise<BulkWriteResult<TEntity>> {
        return this.writeMany(ids, dto, options, (entity, em) => {
            em.assign(entity, dto as never);
        });
    }

    async patch(id: string, dto: TUpdateDto, options?: PersistOptions): Promise<TEntity> {
        const { em, shouldFlush } = this.resolvePersistOptions(options);
        const entity = await this.getById(id, { em });

        // Вызываем хук для каждого потенциального поля или передаем весь DTO целиком
        await this.applyPatchDto(entity, dto, options);

        em.persist(entity);

        if (shouldFlush) {
            await em.flush();
        }

        return entity;
    }

    async patchMany(ids: string[], dto: TUpdateDto, options?: PersistOptions): Promise<BulkWriteResult<TEntity>> {
        return this.writeMany(ids, dto, options, async (entity) => {
            await this.applyPatchDto(entity, dto, options);
        });
    }

    async delete(id: string, options?: PersistOptions): Promise<{ id: string }> {
        const { em, shouldFlush } = this.resolvePersistOptions(options);
        const entity = await this.getById(id, { em });

        entity.deletedAt = new Date();
        em.persist(entity);

        if (shouldFlush) {
            await em.flush();
        }

        return { id };
    }

    /**
     * Общий путь для {@link updateMany} / {@link patchMany}.
     */
    private async writeMany(
        ids: string[],
        dto: TUpdateDto,
        options: PersistOptions | undefined,
        apply: (entity: TEntity, em: EntityManager) => void | Promise<void>,
    ): Promise<BulkWriteResult<TEntity>> {
        const empty: BulkWriteResult<TEntity> = {
            matchedCount: 0,
            modifiedCount: 0,
            items: [],
            missingIds: [],
        };

        if (ids.length === 0) {
            return empty;
        }

        const { em, shouldFlush } = this.resolvePersistOptions(options);
        const uniqueIds = [...new Set(ids)];
        const entities = await em.find(
            this.repository.getEntityName() as EntityName<TEntity>,
            { id: { $in: uniqueIds } } as unknown as FilterQuery<TEntity>,
        );

        const foundIds = new Set(entities.map((entity) => entity.id));
        const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

        let modifiedCount = 0;

        for (const entity of entities) {
            if (!this.dtoChangesEntity(entity, dto)) {
                continue;
            }

            await apply(entity, em);
            em.persist(entity);
            modifiedCount += 1;
        }

        if (shouldFlush && modifiedCount > 0) {
            await em.flush();
        }

        return {
            matchedCount: entities.length,
            modifiedCount,
            items: entities,
            missingIds,
        };
    }

    /**
     * Есть ли в dto значения, отличающиеся от текущих полей сущности.
     * `undefined` в dto игнорируется (как в patch).
     */
    protected dtoChangesEntity(entity: TEntity, dto: TUpdateDto): boolean {
        for (const key of Object.keys(dto as object) as (keyof TUpdateDto)[]) {
            const next = dto[key];

            if (next === undefined) {
                continue;
            }

            const current = (entity as Record<string, unknown>)[key as string];

            if (current instanceof Date && next instanceof Date) {
                if (current.getTime() !== next.getTime()) {
                    return true;
                }

                continue;
            }

            if (current !== next) {
                return true;
            }
        }

        return false;
    }

    /**
     * Хук для применения DTO целиком.
     * Наследники переопределяют его и используют switch/case или точечную обработку.
     */
    // eslint-disable-next-line @typescript-eslint/require-await -- хук: наследники делают await
    protected async applyPatchDto(entity: TEntity, dto: TUpdateDto, _options?: PersistOptions): Promise<void> {
        // По умолчанию просто переносим все определенные поля
        for (const key of Object.keys(dto as object) as (keyof TUpdateDto)[]) {
            if (dto[key] !== undefined) {
                (entity as Record<string, unknown>)[key as string] = dto[key];
            }
        }
    }
}
