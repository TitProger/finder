import { Injectable } from '@nestjs/common';

import { BaseRepositoryImpl } from '../common/base.repository.impl';
import { DailyUsageEntity } from '../../../../../domain/entities/tariff/daily-usage.entity';
import { DailyUsageRepository } from '../../../../../domain/repositories/tariff/daily-usage.repository';

@Injectable()
export class DailyUsageRepositoryImpl
    extends BaseRepositoryImpl<DailyUsageEntity>
    implements DailyUsageRepository
{
    async findOrCreate(userId: string, usageDate: string): Promise<DailyUsageEntity> {
        const existing = await this.em.findOne(DailyUsageEntity, {
            user: userId,
            usageDate,
        });

        if (existing) {
            return existing;
        }

        const created = this.em.create(DailyUsageEntity, {
            user: userId,
            usageDate,
            researchCount: 0,
        });

        await this.em.persistAndFlush(created);

        return created;
    }

    async incrementResearchCount(userId: string, usageDate: string): Promise<void> {
        const usage = await this.findOrCreate(userId, usageDate);

        usage.researchCount += 1;
        await this.em.flush();
    }
}
