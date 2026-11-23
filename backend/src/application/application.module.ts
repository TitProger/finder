import { Module } from '@nestjs/common';

import { DomainModule } from '../domain/domain.module';
import { InfrastructureModule } from '../infrastructure/config/modules/infrastructure.module';
import { LlmCategoryClassifierService } from '../infrastructure/llm/llm-category-classifier.service';
import { GrokWebhookTrigger } from '../infrastructure/research/grok-webhook.trigger';
import { CategoryClassifierPort } from './ports/category-classifier.port';
import { RESEARCH_RUNNER } from './ports/research-runner.port';
import { CATEGORY_ADMIN_SERVICE } from './services/contracts/category/category-admin.service';
import { CLIENT_INQUIRY_SERVICE } from './services/contracts/inquiry/client-inquiry.service';
import { INQUIRY_SERVICE } from './services/contracts/inquiry/inquiry.service';
import { DOSSIER_SERVICE } from './services/contracts/market/dossier.service';
import { OPTIMAL_CARD_SERVICE } from './services/contracts/market/optimal-card.service';
import { RATES_SERVICE } from './services/contracts/rates/rates.service';
import { TAXONOMY_SERVICE } from './services/contracts/taxonomy/taxonomy.service';
import { CategoryAdminServiceImpl } from './services/impls/category/category-admin.service.impl';
import { ClientInquiryServiceImpl } from './services/impls/inquiry/client-inquiry.service.impl';
import { InquiryServiceImpl } from './services/impls/inquiry/inquiry.service.impl';
import { DossierServiceImpl } from './services/impls/market/dossier.service.impl';
import { OptimalCardServiceImpl } from './services/impls/market/optimal-card.service.impl';
import { RatesServiceImpl } from './services/impls/rates/rates.service.impl';
import { TaxonomyServiceImpl } from './services/impls/taxonomy/taxonomy.service.impl';
import { RESEARCH_TRIGGER } from './ports/research-trigger.port';
import { MANAGER_HANDOFF, ManagerHandoffService } from './services/impls/manager/manager-handoff.service';
import { INQUIRY_ECONOMICS, InquiryEconomicsService } from './services/impls/market/inquiry-economics.service';
import { RESEARCH_EVIDENCE_SERVICE } from './services/contracts/research/research-evidence.service';
import { RESEARCH_QUEUE_SERVICE } from './services/contracts/research/research-queue.service';
import { JsonResearchRunner } from './services/impls/research/json-research-runner';
import { RESEARCH_LAUNCH_SERVICE, ResearchLaunchService } from './services/impls/research/research-launch.service';
import { ResearchEvidenceServiceImpl } from './services/impls/research/research-evidence.service.impl';
import { ResearchQueueServiceImpl } from './services/impls/research/research-queue.service.impl';
import { ResearchQueueWorker } from './services/impls/research/research-queue.worker';
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
        { provide: CLIENT_INQUIRY_SERVICE, useClass: ClientInquiryServiceImpl },
        { provide: TAXONOMY_SERVICE, useClass: TaxonomyServiceImpl },
        { provide: RATES_SERVICE, useClass: RatesServiceImpl },
        { provide: OPTIMAL_CARD_SERVICE, useClass: OptimalCardServiceImpl },
        { provide: DOSSIER_SERVICE, useClass: DossierServiceImpl },
        { provide: RESEARCH_RUNNER, useClass: JsonResearchRunner },
        { provide: RESEARCH_TRIGGER, useClass: GrokWebhookTrigger },
        { provide: RESEARCH_LAUNCH_SERVICE, useClass: ResearchLaunchService },
        { provide: RESEARCH_QUEUE_SERVICE, useClass: ResearchQueueServiceImpl },
        { provide: RESEARCH_EVIDENCE_SERVICE, useClass: ResearchEvidenceServiceImpl },
        { provide: MANAGER_HANDOFF, useClass: ManagerHandoffService },
        { provide: INQUIRY_ECONOMICS, useClass: InquiryEconomicsService },
        ResearchQueueWorker,
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
        CLIENT_INQUIRY_SERVICE,
        TAXONOMY_SERVICE,
        RATES_SERVICE,
        OPTIMAL_CARD_SERVICE,
        DOSSIER_SERVICE,
        RESEARCH_RUNNER,
        RESEARCH_LAUNCH_SERVICE,
        RESEARCH_QUEUE_SERVICE,
        RESEARCH_EVIDENCE_SERVICE,
        MANAGER_HANDOFF,
        INQUIRY_ECONOMICS,
        SearchedProductService,
        SearchPackService,
        StoredFileService,
    ],
})
export class ApplicationModule {}
