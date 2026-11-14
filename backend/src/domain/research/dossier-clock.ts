/** Ориентир срока из BDM: снимок около 14 дней, заводская цена и контакт около 30. */

const DAY_MS = 24 * 60 * 60 * 1000;

export const SNAPSHOT_TTL_MS = 14 * DAY_MS;
export const OFFER_TTL_MS = 30 * DAY_MS;

export function addTtl(capturedAt: Date, ttlMs: number): Date {
    return new Date(capturedAt.getTime() + ttlMs);
}
