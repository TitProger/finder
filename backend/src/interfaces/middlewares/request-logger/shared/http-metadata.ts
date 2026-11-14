import { FastifyRequest } from 'fastify';
import { LogMeta, HttpContext } from '../../../../common/logger/logger.context';
import { getCreatedAt } from './request-state';

export function buildMeta(request: FastifyRequest, statusCode: number, durationMs: number): LogMeta {
    const url = request.url.split('?')[0];
    const clientIp = resolveClientIp(request);
    const userAgentHeader = request.headers['user-agent'];

    const httpMeta: HttpContext = {
        method: request.method,
        url,
        status: statusCode,
        durationMs,
        ip: clientIp,
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader.join(',') : userAgentHeader,
        requestId: String(request.id),
        createdAt: getCreatedAt(request),
    };

    const meta: LogMeta = { http: httpMeta };

    return meta;
}

export function resolveClientIp(request: FastifyRequest): string | undefined {
    const header = request.headers?.['x-forwarded-for'];
    const forwarded = Array.isArray(header) ? header.join(',') : header;

    return forwarded ? forwarded.split(',')[0].trim() : request.ip;
}
