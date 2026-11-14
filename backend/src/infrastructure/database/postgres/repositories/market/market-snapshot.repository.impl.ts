import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { MarketSnapshotEntity } from '../../../../../domain/entities/market/market-snapshot.entity';
import { MarketSnapshotRepository as MarketSnapshotRepositoryPort } from '../../../../../domain/repositories/market/market-snapshot.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class MarketSnapshotRepositoryImpl
    extends BaseRepositoryImpl<MarketSnapshotEntity>
    implements MarketSnapshotRepositoryPort
{
    constructor(
        @InjectRepository(MarketSnapshotEntity)
        repository: BaseRepositoryImpl<MarketSnapshotEntity>,
    ) {
        super(repository.getEntityManager(), MarketSnapshotEntity);
    }
}
