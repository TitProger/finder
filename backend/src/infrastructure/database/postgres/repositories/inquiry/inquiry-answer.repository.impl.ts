import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { InquiryAnswerEntity } from '../../../../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryAnswerRepository as InquiryAnswerRepositoryPort } from '../../../../../domain/repositories/inquiry/inquiry-answer.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class InquiryAnswerRepositoryImpl
    extends BaseRepositoryImpl<InquiryAnswerEntity>
    implements InquiryAnswerRepositoryPort
{
    constructor(
        @InjectRepository(InquiryAnswerEntity)
        repository: BaseRepositoryImpl<InquiryAnswerEntity>,
    ) {
        super(repository.getEntityManager(), InquiryAnswerEntity);
    }
}
