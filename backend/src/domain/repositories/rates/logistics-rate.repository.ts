import { LogisticsRateEntity } from '../../entities/rates/logistics-rate.entity';
import { BaseRepository } from '../common/base.repository';

export type LogisticsRateListQuery = {
    page?: number;
    limit?: number;
    activeOnly?: boolean;
};

export type LogisticsRateListResult = {
    items: LogisticsRateEntity[];
    page: number;
    limit: number;
    total: number;
};

export interface LogisticsRateRepository extends BaseRepository<LogisticsRateEntity> {
    list(query: LogisticsRateListQuery): Promise<LogisticsRateListResult>;
    findActive(): Promise<LogisticsRateEntity[]>;
}

export type { LogisticsRateEntity };
