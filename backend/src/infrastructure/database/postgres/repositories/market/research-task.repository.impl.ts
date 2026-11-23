import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { ResearchTaskEntity } from '../../../../../domain/entities/market/research-task.entity';
import { ResearchTaskRepository as ResearchTaskRepositoryPort } from '../../../../../domain/repositories/market/research-task.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class ResearchTaskRepositoryImpl
    extends BaseRepositoryImpl<ResearchTaskEntity>
    implements ResearchTaskRepositoryPort
{
    constructor(
        @InjectRepository(ResearchTaskEntity)
        repository: BaseRepositoryImpl<ResearchTaskEntity>,
    ) {
        super(repository.getEntityManager(), ResearchTaskEntity);
    }
}
