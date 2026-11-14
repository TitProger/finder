import { ForbiddenAppException } from '../../common/exceptions/forbidden.exception';
import { AppUserEntity } from '../../domain/entities/user/app-user.entity';
import { UserRole } from '../../domain/enums/user-role.enum';
import { AppUserRepository } from '../../domain/repositories/user/app-user.repository';
import { AppErrors } from '../errors';
import { adminTelegramIds } from './admin-telegram-ids';

/**
 * Админ для HTTP со статическим токеном: сначала id из ADMIN_TELEGRAM_IDS, иначе любая роль ADMIN.
 */
export async function findActingAdmin(users: AppUserRepository): Promise<AppUserEntity> {
    for (const telegramId of adminTelegramIds()) {
        const match = await users.findOne({ telegramUserId: telegramId, role: UserRole.ADMIN, isActive: true });

        if (match) {
            return match;
        }
    }

    const admins = await users.find({ role: UserRole.ADMIN, isActive: true });
    const admin = admins[0];

    if (!admin) {
        throw new ForbiddenAppException(AppErrors.auth.forbidden.message, {
            code: AppErrors.auth.forbidden.code,
        });
    }

    return admin;
}
