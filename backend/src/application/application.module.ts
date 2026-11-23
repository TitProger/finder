import { Module } from '@nestjs/common';

import { DomainModule } from '../domain/domain.module';
import { InfrastructureModule } from '../infrastructure/config/modules/infrastructure.module';
import { LlmCategoryClassifierService } from '../infrastructure/llm/llm-category-classifier.service';
import { GrokWebhookTrigger } from '../infrastructure/research/grok-webhook.trigger';
import { TelegramManagerNotify } from '../infrastructure/telegram/telegram-manager-notify';
import { TelegramBotApi } from '../interfaces/telegram/telegram-api';
import { TELEGRAM_OUTBOUND } from '../interfaces/telegram/telegram.types';
import { CategoryClassifierPort } from './ports/category-classifier.port';
import { RESEARCH_RUNNER } from './ports/research-runner.port';
import { CATEGORY_ADMIN_SERVICE } from './services/contracts/category/category-admin.service';
import { INQUIRY_SERVICE } from './services/contracts/inquiry/inquiry.service';
import { OPTIMAL_CARD_SERVICE } from './services/contracts/market/optimal-card.service';
import { LIMIT_CHECKER_SERVICE } from './services/contracts/tariff/limit-checker.service';
import { PLAN_MANAGER_SERVICE } from './services/contracts/tariff/plan-manager.service';
import { CategoryAdminServiceImpl } from './services/impls/category/category-admin.service.impl';
import { InquiryServiceImpl } from './services/impls/inquiry/inquiry.service.impl';
import { OptimalCardServiceImpl } from './services/impls/market/optimal-card.service.impl';
import { LimitCheckerServiceImpl } from './services/impls/tariff/limit-checker.service.impl';
import { PlanManagerServiceImpl } from './services/impls/tariff/plan-manager.service.impl';
import { MANAGER_NOTIFY } from './ports/manager-notify.port';
import { RESEARCH_TRIGGER } from './ports/research-trigger.port';
import { MANAGER_HANDOFF, ManagerHandoffService } from './services/impls/manager/manager-handoff.service';
import { INQUIRY_ECONOMICS, InquiryEconomicsService } from './services/impls/market/inquiry-economics.service';
import { JsonResearchRunner } from './services/impls/research/json-research-runner';
import { RESEARCH_LAUNCH_SERVICE, ResearchLaunchService } from './services/impls/research/research-launch.service';
import { ResearchStaleScheduler } from './services/impls/research/research-stale.scheduler';
import { SearchedProductService } from './services/impls/product/searched-product.service';
import { SearchPackService } from './services/impls/search/search-pack.service';
import { StoredFileService } from './services/impls/file/stored-file.service';

/**
 * Слой сценариев.
 * Приём досье — порт ResearchRunner. Реализация читает JSON и наружу не ходит.
 */
@Module({
    imports: [DomainModule, InfrastructureModule],
    providers: [
        { provide: CATEGORY_ADMIN_SERVICE, useClass: CategoryAdminServiceImpl },
        { provide: CategoryClassifierPort, useClass: LlmCategoryClassifierService },
        { provide: INQUIRY_SERVICE, useClass: InquiryServiceImpl },
        { provide: OPTIMAL_CARD_SERVICE, useClass: OptimalCardServiceImpl },
        { provide: LIMIT_CHECKER_SERVICE, useClass: LimitCheckerServiceImpl },
        { provide: PLAN_MANAGER_SERVICE, useClass: PlanManagerServiceImpl },
        { provide: RESEARCH_RUNNER, useClass: JsonResearchRunner },
        { provide: RESEARCH_TRIGGER, useClass: GrokWebhookTrigger },
        { provide: RESEARCH_LAUNCH_SERVICE, useClass: ResearchLaunchService },
        { provide: TELEGRAM_OUTBOUND, useClass: TelegramBotApi },
        { provide: MANAGER_NOTIFY, useClass: TelegramManagerNotify },
        { provide: MANAGER_HANDOFF, useClass: ManagerHandoffService },
        { provide: INQUIRY_ECONOMICS, useClass: InquiryEconomicsService },
        ResearchStaleScheduler,
        SearchedProductService,
        SearchPackService,
        StoredFileService,
    ],
    exports: [
        DomainModule,
        InfrastructureModule,
        CATEGORY_ADMIN_SERVICE,
        INQUIRY_SERVICE,
        OPTIMAL_CARD_SERVICE,
        LIMIT_CHECKER_SERVICE,
        PLAN_MANAGER_SERVICE,
        RESEARCH_RUNNER,
        RESEARCH_LAUNCH_SERVICE,
        MANAGER_HANDOFF,
        INQUIRY_ECONOMICS,
        SearchedProductService,
        SearchPackService,
        StoredFileService,
    ],
})
export class ApplicationModule {}
