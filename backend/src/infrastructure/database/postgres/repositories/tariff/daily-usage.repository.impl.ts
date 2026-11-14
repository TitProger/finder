import { Injectable } from '@nestjs/common';

import { BaseRepositoryImpl } from '../common/base.repository.impl';
import { DailyUsageEntity } from '../../../../../domain/entities/tariff/daily-usage.entity';
import { DailyUsageRepository } from '../../../../../domain/repositories/tariff/daily-usage.repository';

@Injectable()
export class DailyUsageRepositoryImpl extends BaseRepositoryImpl<DailyUsageEntity> implements DailyUsageRepository {
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
        // Атомарный upsert + increment для race-safety
        const knex = this.em.getKnex();

        await knex.raw(
            `
            INSERT INTO daily_usage (id, user_id, usage_date, research_count, created_at, updated_at)
            VALUES (gen_random_uuid(), ?, ?, 1, now(), now())
            ON CONFLICT (user_id, usage_date)
            DO UPDATE SET
                research_count = daily_usage.research_count + 1,
                updated_at = now()
        `,
            [userId, usageDate],
        );
    }
}
