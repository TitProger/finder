import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { CategoryEntity } from '../../../../../domain/entities/category/category.entity';
import { CategoryRepository as CategoryRepositoryPort } from '../../../../../domain/repositories/category/category.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class CategoryRepositoryImpl extends BaseRepositoryImpl<CategoryEntity> implements CategoryRepositoryPort {
    constructor(
        @InjectRepository(CategoryEntity)
        repository: BaseRepositoryImpl<CategoryEntity>,
    ) {
        super(repository.getEntityManager(), CategoryEntity);
    }
}
