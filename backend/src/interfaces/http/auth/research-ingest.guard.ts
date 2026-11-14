import { timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { AppErrors } from '../../../application/errors';
import { UnauthorizedAppException } from '../../../common/exceptions/unauthorized.exception';

/**
 * Отдельный секрет приёма досье. Токен админки сюда не подходит.
 * Сравнение через timingSafeEqual, длина проверяется отдельно.
 */
@Injectable()
export class ResearchIngestGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const header = request.headers.authorization ?? '';
        const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
        const expected = (process.env.RESEARCH_INGEST_TOKEN ?? '').trim();

        if (!expected || !sameSecret(expected, token)) {
            throw new UnauthorizedAppException(AppErrors.auth.unauthorized.message, {
                code: AppErrors.auth.unauthorized.code,
            });
        }

        return true;
    }
}

function sameSecret(expected: string, actual: string): boolean {
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);

    if (left.length !== right.length) {
        return false;
    }

    return timingSafeEqual(left, right);
}
