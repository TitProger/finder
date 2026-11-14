import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { ResearchRunEntity } from '../../../../../domain/entities/market/research-run.entity';
import { ResearchRunRepository as ResearchRunRepositoryPort } from '../../../../../domain/repositories/market/research-run.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class ResearchRunRepositoryImpl
    extends BaseRepositoryImpl<ResearchRunEntity>
    implements ResearchRunRepositoryPort
{
    constructor(
        @InjectRepository(ResearchRunEntity)
        repository: BaseRepositoryImpl<ResearchRunEntity>,
    ) {
        super(repository.getEntityManager(), ResearchRunEntity);
    }
}
