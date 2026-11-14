import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { CategoryQuestionEntity } from '../../../../../domain/entities/category/category-question.entity';
import { CategoryQuestionRepository as CategoryQuestionRepositoryPort } from '../../../../../domain/repositories/category/category-question.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class CategoryQuestionRepositoryImpl
    extends BaseRepositoryImpl<CategoryQuestionEntity>
    implements CategoryQuestionRepositoryPort
{
    constructor(
        @InjectRepository(CategoryQuestionEntity)
        repository: BaseRepositoryImpl<CategoryQuestionEntity>,
    ) {
        super(repository.getEntityManager(), CategoryQuestionEntity);
    }
}
