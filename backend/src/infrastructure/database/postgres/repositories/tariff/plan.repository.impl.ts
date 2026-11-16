import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { PlanEntity } from '../../../../../domain/entities/tariff/plan.entity';
import { PlanRepository } from '../../../../../domain/repositories/tariff/plan.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class PlanRepositoryImpl extends BaseRepositoryImpl<PlanEntity> implements PlanRepository {
    constructor(
        @InjectRepository(PlanEntity)
        repository: BaseRepositoryImpl<PlanEntity>,
    ) {
        super(repository.getEntityManager(), PlanEntity);
    }

    async findByCode(code: string): Promise<PlanEntity | null> {
        return this.em.findOne(PlanEntity, { code });
    }
}
