import { ForbiddenAppException } from '../../common/exceptions/forbidden.exception';
import { AppUserEntity } from '../../domain/entities/user/app-user.entity';
import { UserRole } from '../../domain/enums/user-role.enum';
import { AppUserRepository } from '../../domain/repositories/user/app-user.repository';
import { AppErrors } from '../errors';

/**
 * Админ для HTTP со статическим токеном: первая активная роль ADMIN.
 */
export async function findActingAdmin(users: AppUserRepository): Promise<AppUserEntity> {
    const admins = await users.find({ role: UserRole.ADMIN, isActive: true });
    const admin = admins[0];

    if (!admin) {
        throw new ForbiddenAppException(AppErrors.auth.forbidden.message, {
            code: AppErrors.auth.forbidden.code,
        });
    }

    return admin;
}
