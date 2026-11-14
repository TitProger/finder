import { Module } from '@nestjs/common';

import { DomainModule } from '../domain/domain.module';
import { StubTextEmbedding } from '../infrastructure/embeddings/stub-text-embedding';
import { InfrastructureModule } from '../infrastructure/config/modules/infrastructure.module';
import { RESEARCH_RUNNER } from './ports/research-runner.port';
import { TEXT_EMBEDDING_PORT } from './ports/text-embedding.port';
import { ADMIN_AUTH_SERVICE } from './services/contracts/auth/admin-auth.service';
import { CATEGORY_ADMIN_SERVICE } from './services/contracts/category/category-admin.service';
import { INQUIRY_SERVICE } from './services/contracts/inquiry/inquiry.service';
import { OPTIMAL_CARD_SERVICE } from './services/contracts/market/optimal-card.service';
import { LIMIT_CHECKER_SERVICE } from './services/contracts/tariff/limit-checker.service';
import { PLAN_MANAGER_SERVICE } from './services/contracts/tariff/plan-manager.service';
import { AdminAuthServiceImpl } from './services/impls/auth/admin-auth.service.impl';
import { CategoryAdminServiceImpl } from './services/impls/category/category-admin.service.impl';
import { InquiryServiceImpl } from './services/impls/inquiry/inquiry.service.impl';
import { OptimalCardServiceImpl } from './services/impls/market/optimal-card.service.impl';
import { LimitCheckerServiceImpl } from './services/impls/tariff/limit-checker.service.impl';
import { PlanManagerServiceImpl } from './services/impls/tariff/plan-manager.service.impl';
import { JsonResearchRunner } from './services/impls/research/json-research-runner';

/**
 * Слой сценариев.
 * Эмбеддинг подключается здесь: порт в application, заглушка в infrastructure.
 * Приём досье — порт ResearchRunner. Реализация читает JSON и наружу не ходит.
 */
@Module({
    imports: [DomainModule, InfrastructureModule],
    providers: [
        { provide: CATEGORY_ADMIN_SERVICE, useClass: CategoryAdminServiceImpl },
        { provide: ADMIN_AUTH_SERVICE, useClass: AdminAuthServiceImpl },
        { provide: TEXT_EMBEDDING_PORT, useClass: StubTextEmbedding },
        { provide: INQUIRY_SERVICE, useClass: InquiryServiceImpl },
        { provide: OPTIMAL_CARD_SERVICE, useClass: OptimalCardServiceImpl },
        { provide: LIMIT_CHECKER_SERVICE, useClass: LimitCheckerServiceImpl },
        { provide: PLAN_MANAGER_SERVICE, useClass: PlanManagerServiceImpl },
        { provide: RESEARCH_RUNNER, useClass: JsonResearchRunner },
    ],
    exports: [
        DomainModule,
        InfrastructureModule,
        CATEGORY_ADMIN_SERVICE,
        ADMIN_AUTH_SERVICE,
        TEXT_EMBEDDING_PORT,
        INQUIRY_SERVICE,
        OPTIMAL_CARD_SERVICE,
        LIMIT_CHECKER_SERVICE,
        PLAN_MANAGER_SERVICE,
        RESEARCH_RUNNER,
    ],
})
export class ApplicationModule {}
