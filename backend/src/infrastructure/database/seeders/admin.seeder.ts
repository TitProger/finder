import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { Envs } from '../../../common/envs/env';
import { AppUserEntity } from '../../../domain/entities/user/app-user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { REPOSITORY_TOKENS } from '../../../domain/repositories/repository.tokens';
import { AppUserRepository } from '../../../domain/repositories/user/app-user.repository';
import { PasswordHasher } from '../../security/password-hasher';

/**
 * Сид админа из env. Регистрации нет — учётка появляется при старте.
 */
@Injectable()
export class AdminSeeder implements OnModuleInit {
    private readonly logger = new Logger(AdminSeeder.name);

    constructor(
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
    ) {}

    async onModuleInit(): Promise<void> {
        const login = Envs.adminSeed.login.trim();
        const telegramUserId = Envs.adminSeed.telegramUserId;
        const existing = await this.users.findOne({ login, role: UserRole.ADMIN });

        if (existing) {
            await this.attachTelegram(existing, telegramUserId);

            return;
        }

        const passwordHash = await PasswordHasher.hash(Envs.adminSeed.password);
        const admin = this.users.create({
            role: UserRole.ADMIN,
            login,
            passwordHash,
            displayName: Envs.adminSeed.displayName,
            telegramUserId,
            isActive: true,
            planCode: 'unlimited',
        });

        await this.users.getEntityManager().persistAndFlush(admin);
        this.logger.log(`Seeded ADMIN login=${login}`);
    }

    /** Бот узнаёт админа по telegram user id и роли ADMIN. Пароль в чат не запрашивает. */
    private async attachTelegram(admin: AppUserEntity, telegramUserId: string | null): Promise<void> {
        if (!telegramUserId || admin.telegramUserId === telegramUserId) {
            return;
        }

        const taken = await this.users.findOne({ telegramUserId });

        if (taken && taken.id !== admin.id) {
            this.logger.error('Telegram user id уже занят, админу не записан');

            return;
        }

        admin.telegramUserId = telegramUserId;
        await this.users.getEntityManager().flush();
        this.logger.log(`ADMIN ${admin.login ?? ''} привязан к Telegram`);
    }
}
