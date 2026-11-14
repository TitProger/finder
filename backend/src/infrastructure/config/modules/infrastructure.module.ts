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
import { CompanyEntity } from '../../../domain/entities/catalog/company.entity';
import { StorefrontEntity } from '../../../domain/entities/catalog/storefront.entity';
import { OfferEntity } from '../../../domain/entities/catalog/offer.entity';
import { InquiryEntity } from '../../../domain/entities/inquiry/inquiry.entity';
import { InquiryAnswerEntity } from '../../../domain/entities/inquiry/inquiry-answer.entity';
import { ResearchRunEntity } from '../../../domain/entities/market/research-run.entity';
import { MarketSnapshotEntity } from '../../../domain/entities/market/market-snapshot.entity';
import { OptimalCardEntity } from '../../../domain/entities/market/optimal-card.entity';
import { ManualEconomicsEntity } from '../../../domain/entities/market/manual-economics.entity';
import { PlanEntity } from '../../../domain/entities/tariff/plan.entity';
import { DailyUsageEntity } from '../../../domain/entities/tariff/daily-usage.entity';
import { AppUserRepositoryImpl } from '../../database/postgres/repositories/user/app-user.repository.impl';
import { CategoryRepositoryImpl } from '../../database/postgres/repositories/category/category.repository.impl';
import { CategoryPhraseRepositoryImpl } from '../../database/postgres/repositories/category/category-phrase.repository.impl';
import { QuestionPackRepositoryImpl } from '../../database/postgres/repositories/category/question-pack.repository.impl';
import { CategoryQuestionRepositoryImpl } from '../../database/postgres/repositories/category/category-question.repository.impl';
import { CategorySiteRepositoryImpl } from '../../database/postgres/repositories/category/category-site.repository.impl';
import { CanonicalProductRepositoryImpl } from '../../database/postgres/repositories/catalog/canonical-product.repository.impl';
import { CompanyRepositoryImpl } from '../../database/postgres/repositories/catalog/company.repository.impl';
import { StorefrontRepositoryImpl } from '../../database/postgres/repositories/catalog/storefront.repository.impl';
import { OfferRepositoryImpl } from '../../database/postgres/repositories/catalog/offer.repository.impl';
import { InquiryRepositoryImpl } from '../../database/postgres/repositories/inquiry/inquiry.repository.impl';
import { InquiryAnswerRepositoryImpl } from '../../database/postgres/repositories/inquiry/inquiry-answer.repository.impl';
import { ResearchRunRepositoryImpl } from '../../database/postgres/repositories/market/research-run.repository.impl';
import { MarketSnapshotRepositoryImpl } from '../../database/postgres/repositories/market/market-snapshot.repository.impl';
import { OptimalCardRepositoryImpl } from '../../database/postgres/repositories/market/optimal-card.repository.impl';
import { ManualEconomicsRepositoryImpl } from '../../database/postgres/repositories/market/manual-economics.repository.impl';
import { PlanRepositoryImpl } from '../../database/postgres/repositories/tariff/plan.repository.impl';
import { DailyUsageRepositoryImpl } from '../../database/postgres/repositories/tariff/daily-usage.repository.impl';
import { AdminSeeder } from '../../database/seeders/admin.seeder';
import { JwtTokenService } from '../../security/jwt-token.service';

const entities = [
    AppUserEntity,
    CategoryEntity,
    CategoryPhraseEntity,
    QuestionPackEntity,
    CategoryQuestionEntity,
    CategorySiteEntity,
    CanonicalProductEntity,
    CompanyEntity,
    StorefrontEntity,
    OfferEntity,
    InquiryEntity,
    InquiryAnswerEntity,
    ResearchRunEntity,
    MarketSnapshotEntity,
    OptimalCardEntity,
    ManualEconomicsEntity,
    PlanEntity,
    DailyUsageEntity,
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
        { provide: REPOSITORY_TOKENS.STOREFRONT_REPOSITORY, useClass: StorefrontRepositoryImpl },
        { provide: REPOSITORY_TOKENS.OFFER_REPOSITORY, useClass: OfferRepositoryImpl },
        { provide: REPOSITORY_TOKENS.INQUIRY_REPOSITORY, useClass: InquiryRepositoryImpl },
        { provide: REPOSITORY_TOKENS.INQUIRY_ANSWER_REPOSITORY, useClass: InquiryAnswerRepositoryImpl },
        { provide: REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY, useClass: ResearchRunRepositoryImpl },
        { provide: REPOSITORY_TOKENS.MARKET_SNAPSHOT_REPOSITORY, useClass: MarketSnapshotRepositoryImpl },
        { provide: REPOSITORY_TOKENS.OPTIMAL_CARD_REPOSITORY, useClass: OptimalCardRepositoryImpl },
        { provide: REPOSITORY_TOKENS.MANUAL_ECONOMICS_REPOSITORY, useClass: ManualEconomicsRepositoryImpl },
        { provide: REPOSITORY_TOKENS.PLAN_REPOSITORY, useClass: PlanRepositoryImpl },
        { provide: REPOSITORY_TOKENS.DAILY_USAGE_REPOSITORY, useClass: DailyUsageRepositoryImpl },
        JwtTokenService,
        AdminSeeder,
    ],
    exports: [
        MikroOrmModule,
        JwtTokenService,
        REPOSITORY_TOKENS.APP_USER_REPOSITORY,
        REPOSITORY_TOKENS.CATEGORY_REPOSITORY,
        REPOSITORY_TOKENS.CATEGORY_PHRASE_REPOSITORY,
        REPOSITORY_TOKENS.QUESTION_PACK_REPOSITORY,
        REPOSITORY_TOKENS.CATEGORY_QUESTION_REPOSITORY,
        REPOSITORY_TOKENS.CATEGORY_SITE_REPOSITORY,
        REPOSITORY_TOKENS.CANONICAL_PRODUCT_REPOSITORY,
        REPOSITORY_TOKENS.COMPANY_REPOSITORY,
        REPOSITORY_TOKENS.STOREFRONT_REPOSITORY,
        REPOSITORY_TOKENS.OFFER_REPOSITORY,
        REPOSITORY_TOKENS.INQUIRY_REPOSITORY,
        REPOSITORY_TOKENS.INQUIRY_ANSWER_REPOSITORY,
        REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY,
        REPOSITORY_TOKENS.MARKET_SNAPSHOT_REPOSITORY,
        REPOSITORY_TOKENS.OPTIMAL_CARD_REPOSITORY,
        REPOSITORY_TOKENS.MANUAL_ECONOMICS_REPOSITORY,
        REPOSITORY_TOKENS.PLAN_REPOSITORY,
        REPOSITORY_TOKENS.DAILY_USAGE_REPOSITORY,
    ],
})
export class InfrastructureModule {}
