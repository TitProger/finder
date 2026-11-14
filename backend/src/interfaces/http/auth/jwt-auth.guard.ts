import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

import { AppErrors } from '../../../application/errors';
import { ForbiddenAppException } from '../../../common/exceptions/forbidden.exception';
import { UnauthorizedAppException } from '../../../common/exceptions/unauthorized.exception';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { JwtTokenService } from '../../../infrastructure/security/jwt-token.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export type AuthUser = {
    id: string;
    login: string;
    role: UserRole;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwt: JwtTokenService,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthUser }>();
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            throw new UnauthorizedAppException(AppErrors.auth.unauthorized.message, {
                code: AppErrors.auth.unauthorized.code,
            });
        }
        const token = header.slice('Bearer '.length).trim();
        let payload;
        try {
            payload = this.jwt.verify(token, 'access');
        } catch {
            throw new UnauthorizedAppException(AppErrors.auth.unauthorized.message, {
                code: AppErrors.auth.unauthorized.code,
            });
        }
        if (payload.role !== UserRole.ADMIN) {
            throw new ForbiddenAppException(AppErrors.auth.forbidden.message, {
                code: AppErrors.auth.forbidden.code,
            });
        }
        request.user = { id: payload.sub, login: payload.login, role: payload.role };
        return true;
    }
}
