import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { QuestionPackEntity } from '../../../../../domain/entities/category/question-pack.entity';
import { QuestionPackRepository as QuestionPackRepositoryPort } from '../../../../../domain/repositories/category/question-pack.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class QuestionPackRepositoryImpl extends BaseRepositoryImpl<QuestionPackEntity> implements QuestionPackRepositoryPort {
    constructor(
        @InjectRepository(QuestionPackEntity)
        repository: BaseRepositoryImpl<QuestionPackEntity>,
    ) {
        super(repository.getEntityManager(), QuestionPackEntity);
    }
}
