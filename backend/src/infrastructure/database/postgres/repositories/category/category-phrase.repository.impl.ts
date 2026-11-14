import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { CategoryPhraseEntity } from '../../../../../domain/entities/category/category-phrase.entity';
import { CategoryStatus } from '../../../../../domain/enums/category-status.enum';
import { CategoryPhraseRepository as CategoryPhraseRepositoryPort } from '../../../../../domain/repositories/category/category-phrase.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class CategoryPhraseRepositoryImpl
    extends BaseRepositoryImpl<CategoryPhraseEntity>
    implements CategoryPhraseRepositoryPort
{
    constructor(
        @InjectRepository(CategoryPhraseEntity)
        repository: BaseRepositoryImpl<CategoryPhraseEntity>,
    ) {
        super(repository.getEntityManager(), CategoryPhraseEntity);
    }

    findByCategoryStatus(status: CategoryStatus): Promise<CategoryPhraseEntity[]> {
        return this.find({ category: { status } }, { populate: ['category'] });
    }
}
