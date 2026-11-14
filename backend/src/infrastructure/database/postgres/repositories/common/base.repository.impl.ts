import { EntityRepository } from '@mikro-orm/postgresql';
import { FilterQuery } from '@mikro-orm/core';
import {
    BaseRepository as BaseRepositoryPort,
    PersistableEntity,
} from '../../../../../domain/repositories/common/base.repository';

export class BaseRepositoryImpl<T extends PersistableEntity>
    extends EntityRepository<T>
    implements BaseRepositoryPort<T>
{
    async findByCreatedAt(createdAt: Date): Promise<T[]> {
        return this.find({ createdAt } as FilterQuery<T>);
    }

    async findByUpdatedAt(updatedAt: Date): Promise<T[]> {
        return this.find({ updatedAt } as FilterQuery<T>);
    }

    async findByFilters(filters: Record<string, unknown>): Promise<T[]> {
        return this.find(filters as FilterQuery<T>);
    }

    async getCountByFilter(filters: Record<string, unknown>): Promise<number> {
        const cleanFilters: FilterQuery<T> = Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value !== undefined),
        ) as FilterQuery<T>;

        return this.count(cleanFilters);
    }

    async existsByFilter(filters: Record<string, unknown>): Promise<boolean> {
        return (await this.getCountByFilter(filters)) > 0;
    }
}
