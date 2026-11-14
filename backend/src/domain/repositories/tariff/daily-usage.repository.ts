import { BaseRepository } from '../common/base.repository';
import { DailyUsageEntity } from '../../entities/tariff/daily-usage.entity';

export interface DailyUsageRepository extends BaseRepository<DailyUsageEntity> {
    /**
     * Находит или создаёт запись использования за указанную дату.
     */
    findOrCreate(userId: string, usageDate: string): Promise<DailyUsageEntity>;

    /**
     * Увеличивает счётчик research_count на 1.
     */
    incrementResearchCount(userId: string, usageDate: string): Promise<void>;
}
