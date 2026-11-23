import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ApplicationModule } from '../application/application.module';
import { AdminTokenGuard } from './http/auth/admin-token.guard';
import { CategoryController } from './http/controllers/category/category.controller';
import { HealthController } from './http/controllers/health/health.controller';
import { ClientInquiryController } from './http/controllers/inquiry/client-inquiry.controller';
import { InquiryAdminController } from './http/controllers/inquiry/inquiry-admin.controller';
import { InquiryEconomicsController } from './http/controllers/inquiry/inquiry-economics.controller';
import { ResearchRerunController } from './http/controllers/inquiry/research-rerun.controller';
import { InquiryController } from './http/controllers/inquiry/inquiry.controller';
import { DossierAdminController } from './http/controllers/market/dossier-admin.controller';
import { DossierReportController } from './http/controllers/market/dossier-report.controller';
import { OptimalCardAdminController } from './http/controllers/market/optimal-card-admin.controller';
import { ResearchEvidenceController } from './http/controllers/research/research-evidence.controller';
import { ResearchIngestController } from './http/controllers/research/research-ingest.controller';
import { SearchedProductController } from './http/controllers/product/searched-product.controller';
import { SearchPackController } from './http/controllers/search/search-pack.controller';
import { StoredFileController } from './http/controllers/file/stored-file.controller';
import { RatesAdminController } from './http/controllers/rates/rates-admin.controller';
import { RatesQuoteController } from './http/controllers/rates/rates-quote.controller';
import { TaxonomyAdminController } from './http/controllers/taxonomy/taxonomy-admin.controller';
import { TaxonomyPathController } from './http/controllers/taxonomy/taxonomy-path.controller';
import { SearchedProductMapper } from './http/mappers/product/searched-product.mapper';
import { ClientInquiryHttpService } from './http/services/impls/inquiry/client-inquiry.http-service';
import { DossierHttpService } from './http/services/impls/market/dossier.http-service';
import { RatesHttpService } from './http/services/impls/rates/rates.http-service';
import { ResearchEvidenceHttpService } from './http/services/impls/research/research-evidence.http-service';
import { ResearchIngestHttpService } from './http/services/impls/research/research-ingest.http-service';
import { SearchedProductHttpService } from './http/services/impls/product/searched-product.http-service';
import { StoredFileHttpService } from './http/services/impls/file/stored-file.http-service';
import { TaxonomyHttpService } from './http/services/impls/taxonomy/taxonomy.http-service';

/**
 * InterfacesModule — HTTP-контроллеры.
 * Контроллеры ходят в application, не в SQL.
 */
@Module({
    imports: [ApplicationModule],
    controllers: [
        HealthController,
        CategoryController,
        TaxonomyPathController,
        TaxonomyAdminController,
        RatesAdminController,
        RatesQuoteController,
        InquiryController,
        ClientInquiryController,
        InquiryAdminController,
        ResearchRerunController,
        InquiryEconomicsController,
        OptimalCardAdminController,
        DossierAdminController,
        DossierReportController,
        ResearchIngestController,
        ResearchEvidenceController,
        SearchedProductController,
        SearchPackController,
        StoredFileController,
    ],
    providers: [
        SearchedProductMapper,
        SearchedProductHttpService,
        StoredFileHttpService,
        DossierHttpService,
        ClientInquiryHttpService,
        ResearchIngestHttpService,
        ResearchEvidenceHttpService,
        TaxonomyHttpService,
        RatesHttpService,
        { provide: APP_GUARD, useClass: AdminTokenGuard },
    ],
})
export class InterfacesModule {}
