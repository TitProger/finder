import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ApplicationModule } from '../application/application.module';
import { AdminTokenGuard } from './http/auth/admin-token.guard';
import { AdminAuthController } from './http/controllers/auth/admin-auth.controller';
import { CategoryController } from './http/controllers/category/category.controller';
import { HealthController } from './http/controllers/health/health.controller';
import { InquiryAdminController } from './http/controllers/inquiry/inquiry-admin.controller';
import { InquiryEconomicsController } from './http/controllers/inquiry/inquiry-economics.controller';
import { ResearchRerunController } from './http/controllers/inquiry/research-rerun.controller';
import { InquiryController } from './http/controllers/inquiry/inquiry.controller';
import { OptimalCardAdminController } from './http/controllers/market/optimal-card-admin.controller';
import { ResearchIngestController } from './http/controllers/research/research-ingest.controller';
import { PlanAdminController } from './http/controllers/tariff/plan-admin.controller';
import { TelegramBotApi } from './telegram/telegram-api';
import { TelegramDialog } from './telegram/telegram-dialog';
import { TelegramPoller } from './telegram/telegram-poller';
import { TELEGRAM_OUTBOUND } from './telegram/telegram.types';

/**
 * InterfacesModule — HTTP-контроллеры и Telegram-бот.
 * Бот ходит в application, не в SQL.
 */
@Module({
    imports: [ApplicationModule],
    controllers: [
        HealthController,
        AdminAuthController,
        CategoryController,
        InquiryController,
        InquiryAdminController,
        ResearchRerunController,
        InquiryEconomicsController,
        OptimalCardAdminController,
        PlanAdminController,
        ResearchIngestController,
    ],
    providers: [
        { provide: APP_GUARD, useClass: AdminTokenGuard },
        TelegramBotApi,
        { provide: TELEGRAM_OUTBOUND, useExisting: TelegramBotApi },
        TelegramDialog,
        TelegramPoller,
    ],
})
export class InterfacesModule {}
