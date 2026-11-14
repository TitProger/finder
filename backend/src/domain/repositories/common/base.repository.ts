import { EntityRepository } from '@mikro-orm/postgresql';

export type PersistableEntity = {
    readonly id: string;
    createdAt: Date;
    updatedAt: Date | null;
};

export interface BaseRepository<T extends PersistableEntity> extends EntityRepository<T> {
    findByCreatedAt(createdAt: Date): Promise<T[]>;
    findByUpdatedAt(updatedAt: Date): Promise<T[]>;
    findByFilters(filters: Record<string, unknown>): Promise<T[]>;
    getCountByFilter(filters: Record<string, unknown>): Promise<number>;
    existsByFilter(filters: Record<string, unknown>): Promise<boolean>;
}
