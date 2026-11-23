import { FilterQuery } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { LogisticsRateEntity } from '../../../../../domain/entities/rates/logistics-rate.entity';
import {
    LogisticsRateListQuery,
    LogisticsRateListResult,
    LogisticsRateRepository,
} from '../../../../../domain/repositories/rates/logistics-rate.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class LogisticsRateRepositoryImpl
    extends BaseRepositoryImpl<LogisticsRateEntity>
    implements LogisticsRateRepository
{
    constructor(
        @InjectRepository(LogisticsRateEntity)
        repository: BaseRepositoryImpl<LogisticsRateEntity>,
    ) {
        super(repository.getEntityManager(), LogisticsRateEntity);
    }

    async list(query: LogisticsRateListQuery): Promise<LogisticsRateListResult> {
        const page = Math.max(query.page ?? 1, 1);
        const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
        const where: FilterQuery<LogisticsRateEntity> = {};

        if (query.activeOnly) {
            where.isActive = true;
        }

        const [items, total] = await this.findAndCount(where, {
            orderBy: [{ destination: 'asc' }, { mode: 'asc' }, { createdAt: 'asc' }],
            limit,
            offset: (page - 1) * limit,
        });

        return { items, page, limit, total };
    }

    findActive(): Promise<LogisticsRateEntity[]> {
        return this.find(
            { isActive: true },
            { orderBy: [{ destination: 'asc' }, { mode: 'asc' }, { createdAt: 'asc' }] },
        );
    }
}
