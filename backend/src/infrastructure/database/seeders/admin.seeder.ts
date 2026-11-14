import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { adminTelegramIds } from '../../../application/telegram/admin-telegram-ids';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { REPOSITORY_TOKENS } from '../../../domain/repositories/repository.tokens';
import { AppUserRepository } from '../../../domain/repositories/user/app-user.repository';

/**
 * Сид админов из ADMIN_TELEGRAM_IDS. Пароля нет: HTTP ходит со статическим токеном, бот — по Telegram id.
 */
@Injectable()
export class AdminSeeder implements OnModuleInit {
    private readonly logger = new Logger(AdminSeeder.name);

    constructor(
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
    ) {}

    async onModuleInit(): Promise<void> {
        for (const telegramUserId of adminTelegramIds()) {
            await this.ensureAdmin(telegramUserId);
        }
    }

    private async ensureAdmin(telegramUserId: string): Promise<void> {
        const existing = await this.users.findOne({ telegramUserId });

        if (existing) {
            if (existing.role !== UserRole.ADMIN) {
                this.logger.error(`Telegram ${telegramUserId} уже занят, админ не создан`);
            }

            return;
        }

        const admin = this.users.create({
            role: UserRole.ADMIN,
            telegramUserId,
            displayName: `Admin ${telegramUserId}`,
            isActive: true,
            planCode: 'unlimited',
        });

        await this.users.getEntityManager().persistAndFlush(admin);
        this.logger.log(`Seeded ADMIN telegram=${telegramUserId}`);
    }
}
