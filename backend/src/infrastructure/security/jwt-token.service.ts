import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';

import { Envs } from '../../common/envs/env';
import { UserRole } from '../../domain/enums/user-role.enum';

export type JwtPayload = {
    sub: string;
    login: string;
    role: UserRole;
    typ: 'access' | 'refresh';
    iat: number;
    exp: number;
};

@Injectable()
export class JwtTokenService {
    signAccess(payload: Omit<JwtPayload, 'typ' | 'iat' | 'exp'>): { token: string; expiresIn: number } {
        const expiresIn = Envs.jwt.accessTtlSec;

        return { token: this.sign({ ...payload, typ: 'access' }, expiresIn), expiresIn };
    }

    signRefresh(payload: Omit<JwtPayload, 'typ' | 'iat' | 'exp'>): string {
        return this.sign({ ...payload, typ: 'refresh' }, Envs.jwt.refreshTtlSec);
    }

    verify(token: string, expectedTyp: 'access' | 'refresh'): JwtPayload {
        const [headerB64, payloadB64, signatureB64] = token.split('.');

        if (!headerB64 || !payloadB64 || !signatureB64) {
            throw new Error('INVALID_TOKEN');
        }

        const data = `${headerB64}.${payloadB64}`;
        const expected = this.hmac(data);
        const actual = Buffer.from(signatureB64, 'base64url');

        if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
            throw new Error('INVALID_TOKEN');
        }

        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as JwtPayload;

        if (payload.typ !== expectedTyp) {
            throw new Error('INVALID_TOKEN');
        }

        if (payload.exp * 1000 < Date.now()) {
            throw new Error('TOKEN_EXPIRED');
        }

        return payload;
    }

    private sign(payload: Omit<JwtPayload, 'iat' | 'exp'> & { typ: 'access' | 'refresh' }, ttlSec: number): string {
        const header = { alg: 'HS256', typ: 'JWT' };
        const now = Math.floor(Date.now() / 1000);
        const body: JwtPayload = { ...payload, iat: now, exp: now + ttlSec };
        const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
        const payloadB64 = Buffer.from(JSON.stringify(body)).toString('base64url');
        const data = `${headerB64}.${payloadB64}`;
        const signature = this.hmac(data).toString('base64url');

        return `${data}.${signature}`;
    }

    private hmac(data: string): Buffer {
        return createHmac('sha256', Envs.jwt.secret).update(data).digest();
    }
}
