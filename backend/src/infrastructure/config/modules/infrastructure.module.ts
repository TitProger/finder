import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { REPOSITORY_TOKENS } from '../../../domain/repositories/repository.tokens';
import { AppUserEntity } from '../../../domain/entities/user/app-user.entity';
import { CategoryEntity } from '../../../domain/entities/category/category.entity';
import { CategoryPhraseEntity } from '../../../domain/entities/category/category-phrase.entity';
import { QuestionPackEntity } from '../../../domain/entities/category/question-pack.entity';
import { CategoryQuestionEntity } from '../../../domain/entities/category/category-question.entity';
import { CategorySiteEntity } from '../../../domain/entities/category/category-site.entity';
import { CanonicalProductEntity } from '../../../domain/entities/catalog/canonical-product.entity';
import { CompanyContactEntity } from '../../../domain/entities/catalog/company-contact.entity';
import { CompanyEntity } from '../../../domain/entities/catalog/company.entity';
import { StorefrontEntity } from '../../../domain/entities/catalog/storefront.entity';
import { OfferEntity } from '../../../domain/entities/catalog/offer.entity';
import { InquiryEntity } from '../../../domain/entities/inquiry/inquiry.entity';
import { InquiryAnswerEntity } from '../../../domain/entities/inquiry/inquiry-answer.entity';
import { ResearchRunEntity } from '../../../domain/entities/market/research-run.entity';
import { ResearchTaskEntity } from '../../../domain/entities/market/research-task.entity';
import { OptimalCardEntity } from '../../../domain/entities/market/optimal-card.entity';
import { ManualEconomicsEntity } from '../../../domain/entities/market/manual-economics.entity';
import { StoredFileEntity } from '../../../domain/entities/file/stored-file.entity';
import { SearchedProductEntity } from '../../../domain/entities/catalog/searched-product.entity';
import { LogisticsRateEntity } from '../../../domain/entities/rates/logistics-rate.entity';
import { TaxonomyNodeEntity } from '../../../domain/entities/taxonomy/taxonomy-node.entity';
import { AppUserRepositoryImpl } from '../../database/postgres/repositories/user/app-user.repository.impl';
import { CategoryRepositoryImpl } from '../../database/postgres/repositories/category/category.repository.impl';
import { CategoryPhraseRepositoryImpl } from '../../database/postgres/repositories/category/category-phrase.repository.impl';
import { QuestionPackRepositoryImpl } from '../../database/postgres/repositories/category/question-pack.repository.impl';
import { CategoryQuestionRepositoryImpl } from '../../database/postgres/repositories/category/category-question.repository.impl';
import { CategorySiteRepositoryImpl } from '../../database/postgres/repositories/category/category-site.repository.impl';
import { CanonicalProductRepositoryImpl } from '../../database/postgres/repositories/catalog/canonical-product.repository.impl';
import { CompanyContactRepositoryImpl } from '../../database/postgres/repositories/catalog/company-contact.repository.impl';
import { CompanyRepositoryImpl } from '../../database/postgres/repositories/catalog/company.repository.impl';
import { StorefrontRepositoryImpl } from '../../database/postgres/repositories/catalog/storefront.repository.impl';
import { OfferRepositoryImpl } from '../../database/postgres/repositories/catalog/offer.repository.impl';
import { InquiryRepositoryImpl } from '../../database/postgres/repositories/inquiry/inquiry.repository.impl';
import { InquiryAnswerRepositoryImpl } from '../../database/postgres/repositories/inquiry/inquiry-answer.repository.impl';
import { ResearchRunRepositoryImpl } from '../../database/postgres/repositories/market/research-run.repository.impl';
import { ResearchTaskRepositoryImpl } from '../../database/postgres/repositories/market/research-task.repository.impl';
import { OptimalCardRepositoryImpl } from '../../database/postgres/repositories/market/optimal-card.repository.impl';
import { ManualEconomicsRepositoryImpl } from '../../database/postgres/repositories/market/manual-economics.repository.impl';
import { StoredFileRepositoryImpl } from '../../database/postgres/repositories/file/stored-file.repository.impl';
import { SearchedProductRepositoryImpl } from '../../database/postgres/repositories/catalog/searched-product.repository.impl';
import { LogisticsRateRepositoryImpl } from '../../database/postgres/repositories/rates/logistics-rate.repository.impl';
import { TaxonomyNodeRepositoryImpl } from '../../database/postgres/repositories/taxonomy/taxonomy-node.repository.impl';
import { AdminSeeder } from '../../database/seeders/admin.seeder';
import { CategorySeederService } from '../../database/seeders/category-seeder.service';
import { DatabaseSeeder } from '../../database/seeders/database.seeder';
import { DemoProductsSeeder } from '../../database/seeders/demo/demo-products.seeder';
import { WikkeoTaxonomySeeder } from '../../database/seeders/wikkeo-taxonomy.seeder';
import { FILE_STORAGE } from '../../../application/ports/file-storage.port';
import { LocalFileStorage } from '../../storage/local-file-storage';

const entities = [
    AppUserEntity,
    CategoryEntity,
    CategoryPhraseEntity,
    QuestionPackEntity,
    CategoryQuestionEntity,
    CategorySiteEntity,
    CanonicalProductEntity,
    CompanyEntity,
    CompanyContactEntity,
    StorefrontEntity,
    OfferEntity,
    InquiryEntity,
    InquiryAnswerEntity,
    ResearchRunEntity,
    ResearchTaskEntity,
    OptimalCardEntity,
    ManualEconomicsEntity,
    StoredFileEntity,
    SearchedProductEntity,
    TaxonomyNodeEntity,
    LogisticsRateEntity,
];

@Module({
    imports: [MikroOrmModule.forFeature(entities)],
    providers: [
        { provide: REPOSITORY_TOKENS.APP_USER_REPOSITORY, useClass: AppUserRepositoryImpl },
        { provide: REPOSITORY_TOKENS.CATEGORY_REPOSITORY, useClass: CategoryRepositoryImpl },
        { provide: REPOSITORY_TOKENS.CATEGORY_PHRASE_REPOSITORY, useClass: CategoryPhraseRepositoryImpl },
        { provide: REPOSITORY_TOKENS.QUESTION_PACK_REPOSITORY, useClass: QuestionPackRepositoryImpl },
        { provide: REPOSITORY_TOKENS.CATEGORY_QUESTION_REPOSITORY, useClass: CategoryQuestionRepositoryImpl },
        { provide: REPOSITORY_TOKENS.CATEGORY_SITE_REPOSITORY, useClass: CategorySiteRepositoryImpl },
        { provide: REPOSITORY_TOKENS.CANONICAL_PRODUCT_REPOSITORY, useClass: CanonicalProductRepositoryImpl },
        { provide: REPOSITORY_TOKENS.COMPANY_REPOSITORY, useClass: CompanyRepositoryImpl },
        { provide: REPOSITORY_TOKENS.COMPANY_CONTACT_REPOSITORY, useClass: CompanyContactRepositoryImpl },
        { provide: REPOSITORY_TOKENS.STOREFRONT_REPOSITORY, useClass: StorefrontRepositoryImpl },
        { provide: REPOSITORY_TOKENS.OFFER_REPOSITORY, useClass: OfferRepositoryImpl },
        { provide: REPOSITORY_TOKENS.INQUIRY_REPOSITORY, useClass: InquiryRepositoryImpl },
        { provide: REPOSITORY_TOKENS.INQUIRY_ANSWER_REPOSITORY, useClass: InquiryAnswerRepositoryImpl },
        { provide: REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY, useClass: ResearchRunRepositoryImpl },
        { provide: REPOSITORY_TOKENS.RESEARCH_TASK_REPOSITORY, useClass: ResearchTaskRepositoryImpl },
        { provide: REPOSITORY_TOKENS.OPTIMAL_CARD_REPOSITORY, useClass: OptimalCardRepositoryImpl },
        { provide: REPOSITORY_TOKENS.MANUAL_ECONOMICS_REPOSITORY, useClass: ManualEconomicsRepositoryImpl },
        { provide: REPOSITORY_TOKENS.STORED_FILE_REPOSITORY, useClass: StoredFileRepositoryImpl },
        { provide: REPOSITORY_TOKENS.SEARCHED_PRODUCT_REPOSITORY, useClass: SearchedProductRepositoryImpl },
        { provide: REPOSITORY_TOKENS.TAXONOMY_NODE_REPOSITORY, useClass: TaxonomyNodeRepositoryImpl },
        { provide: REPOSITORY_TOKENS.LOGISTICS_RATE_REPOSITORY, useClass: LogisticsRateRepositoryImpl },
        { provide: FILE_STORAGE, useClass: LocalFileStorage },
        AdminSeeder,
        CategorySeederService,
        DemoProductsSeeder,
        WikkeoTaxonomySeeder,
        DatabaseSeeder,
    ],
    exports: [
        MikroOrmModule,
        REPOSITORY_TOKENS.APP_USER_REPOSITORY,
        REPOSITORY_TOKENS.CATEGORY_REPOSITORY,
        REPOSITORY_TOKENS.CATEGORY_PHRASE_REPOSITORY,
        REPOSITORY_TOKENS.QUESTION_PACK_REPOSITORY,
        REPOSITORY_TOKENS.CATEGORY_QUESTION_REPOSITORY,
        REPOSITORY_TOKENS.CATEGORY_SITE_REPOSITORY,
        REPOSITORY_TOKENS.CANONICAL_PRODUCT_REPOSITORY,
        REPOSITORY_TOKENS.COMPANY_REPOSITORY,
        REPOSITORY_TOKENS.COMPANY_CONTACT_REPOSITORY,
        REPOSITORY_TOKENS.STOREFRONT_REPOSITORY,
        REPOSITORY_TOKENS.OFFER_REPOSITORY,
        REPOSITORY_TOKENS.INQUIRY_REPOSITORY,
        REPOSITORY_TOKENS.INQUIRY_ANSWER_REPOSITORY,
        REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY,
        REPOSITORY_TOKENS.RESEARCH_TASK_REPOSITORY,
        REPOSITORY_TOKENS.OPTIMAL_CARD_REPOSITORY,
        REPOSITORY_TOKENS.MANUAL_ECONOMICS_REPOSITORY,
        REPOSITORY_TOKENS.STORED_FILE_REPOSITORY,
        REPOSITORY_TOKENS.SEARCHED_PRODUCT_REPOSITORY,
        REPOSITORY_TOKENS.TAXONOMY_NODE_REPOSITORY,
        REPOSITORY_TOKENS.LOGISTICS_RATE_REPOSITORY,
        FILE_STORAGE,
        DatabaseSeeder,
    ],
})
export class InfrastructureModule {}
