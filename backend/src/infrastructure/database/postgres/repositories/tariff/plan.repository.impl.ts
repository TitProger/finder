import { Injectable } from '@nestjs/common';

import { BaseRepositoryImpl } from '../common/base.repository.impl';
import { PlanEntity } from '../../../../../domain/entities/tariff/plan.entity';
import { PlanRepository } from '../../../../../domain/repositories/tariff/plan.repository';

@Injectable()
export class PlanRepositoryImpl extends BaseRepositoryImpl<PlanEntity> implements PlanRepository {
    async findByCode(code: string): Promise<PlanEntity | null> {
        return this.em.findOne(PlanEntity, { code });
    }
}
