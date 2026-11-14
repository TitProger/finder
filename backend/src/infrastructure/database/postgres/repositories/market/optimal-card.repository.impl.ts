import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { OptimalCardEntity } from '../../../../../domain/entities/market/optimal-card.entity';
import { OptimalCardRepository as OptimalCardRepositoryPort } from '../../../../../domain/repositories/market/optimal-card.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class OptimalCardRepositoryImpl extends BaseRepositoryImpl<OptimalCardEntity> implements OptimalCardRepositoryPort {
    constructor(
        @InjectRepository(OptimalCardEntity)
        repository: BaseRepositoryImpl<OptimalCardEntity>,
    ) {
        super(repository.getEntityManager(), OptimalCardEntity);
    }
}
