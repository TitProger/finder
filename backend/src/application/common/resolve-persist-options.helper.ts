import { EntityManager } from '@mikro-orm/core';

import type { PersistOptions } from '@/application/services/contracts/common/crud.service';

/**
 * EM из options или fallback (обычно EM репозитория).
 */
export function resolveEntityManager(em: EntityManager | undefined, fallbackEm: EntityManager): EntityManager {
    return em ?? fallbackEm;
}

/**
 * EM и флаг flush из {@link PersistOptions}.
 *
 * @example
 * const { em, shouldFlush } = resolvePersistOptions(options, this.repository.getEntityManager());
 */
export function resolvePersistOptions(
    options: PersistOptions | undefined,
    fallbackEm: EntityManager,
): {
    em: EntityManager;
    shouldFlush: boolean;
} {
    return {
        em: resolveEntityManager(options?.em, fallbackEm),
        shouldFlush: options?.flush ?? true,
    };
}
