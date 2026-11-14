import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { InquiryEntity } from '../../../../../domain/entities/inquiry/inquiry.entity';
import { InquiryRepository as InquiryRepositoryPort } from '../../../../../domain/repositories/inquiry/inquiry.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class InquiryRepositoryImpl extends BaseRepositoryImpl<InquiryEntity> implements InquiryRepositoryPort {
    constructor(
        @InjectRepository(InquiryEntity)
        repository: BaseRepositoryImpl<InquiryEntity>,
    ) {
        super(repository.getEntityManager(), InquiryEntity);
    }
}
