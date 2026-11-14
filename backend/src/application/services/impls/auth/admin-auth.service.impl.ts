import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { AdminAuthService, AdminAuthTokensResult } from '../../contracts/auth/admin-auth.service';
import { UnauthorizedAppException } from '../../../../common/exceptions/unauthorized.exception';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { JwtTokenService } from '../../../../infrastructure/security/jwt-token.service';
import { PasswordHasher } from '../../../../infrastructure/security/password-hasher';

@Injectable()
export class AdminAuthServiceImpl implements AdminAuthService {
    constructor(
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
        private readonly jwt: JwtTokenService,
    ) {}

    async login(login: string, password: string): Promise<AdminAuthTokensResult> {
        const trimmed = login.trim();
        const user = await this.users.findOne({ login: trimmed, role: UserRole.ADMIN });
        if (!user || !user.passwordHash) {
            throw new UnauthorizedAppException(AppErrors.auth.invalidCredentials.message, {
                code: AppErrors.auth.invalidCredentials.code,
            });
        }
        if (!user.isActive) {
            throw new UnauthorizedAppException(AppErrors.auth.userInactive.message, {
                code: AppErrors.auth.userInactive.code,
            });
        }
        const ok = await PasswordHasher.verify(password, user.passwordHash);
        if (!ok) {
            throw new UnauthorizedAppException(AppErrors.auth.invalidCredentials.message, {
                code: AppErrors.auth.invalidCredentials.code,
            });
        }
        return this.issueTokens(user.id, user.login!, user.displayName ?? null);
    }

    async refresh(refreshToken: string): Promise<AdminAuthTokensResult> {
        let payload;
        try {
            payload = this.jwt.verify(refreshToken, 'refresh');
        } catch {
            throw new UnauthorizedAppException(AppErrors.auth.invalidRefreshToken.message, {
                code: AppErrors.auth.invalidRefreshToken.code,
            });
        }
        if (payload.role !== UserRole.ADMIN) {
            throw new UnauthorizedAppException(AppErrors.auth.invalidRefreshToken.message, {
                code: AppErrors.auth.invalidRefreshToken.code,
            });
        }
        const user = await this.users.findOne({ id: payload.sub, role: UserRole.ADMIN });
        if (!user || !user.isActive || !user.login) {
            throw new UnauthorizedAppException(AppErrors.auth.invalidRefreshToken.message, {
                code: AppErrors.auth.invalidRefreshToken.code,
            });
        }
        return this.issueTokens(user.id, user.login, user.displayName ?? null);
    }

    private issueTokens(id: string, login: string, displayName: string | null): AdminAuthTokensResult {
        const access = this.jwt.signAccess({ sub: id, login, role: UserRole.ADMIN });
        const refreshToken = this.jwt.signRefresh({ sub: id, login, role: UserRole.ADMIN });
        return {
            accessToken: access.token,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: access.expiresIn,
            admin: {
                id,
                login,
                role: 'ADMIN',
                displayName,
            },
        };
    }
}
