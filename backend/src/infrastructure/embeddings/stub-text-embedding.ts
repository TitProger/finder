import { Injectable } from '@nestjs/common';

import { EMBEDDING_DIMENSIONS } from '../../domain/entities/common/vector.type';

/**
 * Заглушка эмбеддинга.
 * Вектор один и тот же на любой текст, в ответе stub=true.
 * Какую модель звать по API, этот этап не выбирает. В базу вектор не пишем.
 */
const STUB_VECTOR: readonly number[] = Object.freeze(
    Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => (index === 0 ? 1 : 0)),
);

@Injectable()
export class StubTextEmbedding {
    embed(_text: string): Promise<{ vector: number[]; stub: true }> {
        return Promise.resolve({ vector: [...STUB_VECTOR], stub: true });
    }
}
