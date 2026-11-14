import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { OfferEntity } from '../../../../../domain/entities/catalog/offer.entity';
import { OfferRepository as OfferRepositoryPort } from '../../../../../domain/repositories/catalog/offer.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class OfferRepositoryImpl extends BaseRepositoryImpl<OfferEntity> implements OfferRepositoryPort {
    constructor(
        @InjectRepository(OfferEntity)
        repository: BaseRepositoryImpl<OfferEntity>,
    ) {
        super(repository.getEntityManager(), OfferEntity);
    }
}
