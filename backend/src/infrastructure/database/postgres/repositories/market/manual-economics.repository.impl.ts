import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { ManualEconomicsEntity } from '../../../../../domain/entities/market/manual-economics.entity';
import { ManualEconomicsRepository as ManualEconomicsRepositoryPort } from '../../../../../domain/repositories/market/manual-economics.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class ManualEconomicsRepositoryImpl
    extends BaseRepositoryImpl<ManualEconomicsEntity>
    implements ManualEconomicsRepositoryPort
{
    constructor(
        @InjectRepository(ManualEconomicsEntity)
        repository: BaseRepositoryImpl<ManualEconomicsEntity>,
    ) {
        super(repository.getEntityManager(), ManualEconomicsEntity);
    }
}
