import { BaseRepository } from '../common/base.repository';
import { PlanEntity } from '../../entities/tariff/plan.entity';

export interface PlanRepository extends BaseRepository<PlanEntity> {
    findByCode(code: string): Promise<PlanEntity | null>;
}
