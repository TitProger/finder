import { FastifyRequest } from 'fastify';

const startTimes = new WeakMap<FastifyRequest, number>();
const createdAts = new WeakMap<FastifyRequest, string>();

export function setTimestamps(request: FastifyRequest): void {
    const now = Date.now();

    startTimes.set(request, now);
    createdAts.set(request, new Date(now).toISOString());
}

export function calcDuration(request: FastifyRequest): number {
    return Date.now() - (startTimes.get(request) ?? Date.now());
}

export function getCreatedAt(request: FastifyRequest): string | undefined {
    return createdAts.get(request);
}
