import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ApplicationModule } from '../application/application.module';
import { JwtAuthGuard } from './http/auth/jwt-auth.guard';
import { AdminAuthController } from './http/controllers/auth/admin-auth.controller';
import { CategoryController } from './http/controllers/category/category.controller';
import { HealthController } from './http/controllers/health/health.controller';
import { InquiryAdminController } from './http/controllers/inquiry/inquiry-admin.controller';
import { InquiryController } from './http/controllers/inquiry/inquiry.controller';
import { OptimalCardAdminController } from './http/controllers/market/optimal-card-admin.controller';
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
        OptimalCardAdminController,
    ],
    providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        TelegramBotApi,
        { provide: TELEGRAM_OUTBOUND, useExisting: TelegramBotApi },
        TelegramDialog,
        TelegramPoller,
    ],
})
export class InterfacesModule {}
