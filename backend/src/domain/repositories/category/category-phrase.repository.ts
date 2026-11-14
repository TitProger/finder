import { CategoryPhraseEntity } from '../../entities/category/category-phrase.entity';
import { CategoryStatus } from '../../enums/category-status.enum';
import { BaseRepository } from '../common/base.repository';

export interface CategoryPhraseRepository extends BaseRepository<CategoryPhraseEntity> {
    findByCategoryStatus(status: CategoryStatus): Promise<CategoryPhraseEntity[]>;
}
