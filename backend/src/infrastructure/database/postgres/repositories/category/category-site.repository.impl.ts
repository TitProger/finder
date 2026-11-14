import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { CategorySiteEntity } from '../../../../../domain/entities/category/category-site.entity';
import { CategorySiteRepository as CategorySiteRepositoryPort } from '../../../../../domain/repositories/category/category-site.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class CategorySiteRepositoryImpl
    extends BaseRepositoryImpl<CategorySiteEntity>
    implements CategorySiteRepositoryPort
{
    constructor(
        @InjectRepository(CategorySiteEntity)
        repository: BaseRepositoryImpl<CategorySiteEntity>,
    ) {
        super(repository.getEntityManager(), CategorySiteEntity);
    }
}
