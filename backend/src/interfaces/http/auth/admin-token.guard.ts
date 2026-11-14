import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

import { AppErrors } from '../../../application/errors';
import { UnauthorizedAppException } from '../../../common/exceptions/unauthorized.exception';
import { Envs } from '../../../common/envs/env';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Guard админских HTTP-ручек: Bearer должен совпасть с ADMIN_API_TOKEN.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const header = request.headers.authorization;

        if (!header?.startsWith('Bearer ')) {
            throw new UnauthorizedAppException(AppErrors.auth.unauthorized.message, {
                code: AppErrors.auth.unauthorized.code,
            });
        }

        const token = header.slice('Bearer '.length).trim();
        const staticToken = (process.env.ADMIN_API_TOKEN || Envs.admin.apiToken || '').trim();

        if (!staticToken || token !== staticToken) {
            throw new UnauthorizedAppException(AppErrors.auth.unauthorized.message, {
                code: AppErrors.auth.unauthorized.code,
            });
        }

        return true;
    }
}
