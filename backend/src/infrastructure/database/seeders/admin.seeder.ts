import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { UserRole } from '../../../domain/enums/user-role.enum';
import { REPOSITORY_TOKENS } from '../../../domain/repositories/repository.tokens';
import { AppUserRepository } from '../../../domain/repositories/user/app-user.repository';

/**
 * Если админа ещё нет, создаёт одного с displayName Admin.
 * HTTP ходит со статическим токеном.
 */
@Injectable()
export class AdminSeeder implements OnModuleInit {
    private readonly logger = new Logger(AdminSeeder.name);

    constructor(
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
    ) {}

    async onModuleInit(): Promise<void> {
        const existing = await this.users.find({ role: UserRole.ADMIN });

        if (existing.length > 0) {
            return;
        }

        const admin = this.users.create({
            role: UserRole.ADMIN,
            displayName: 'Admin',
            isActive: true,
        });

        await this.users.getEntityManager().persistAndFlush(admin);
        this.logger.log('Seeded ADMIN');
    }
}
