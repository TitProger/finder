import { EMBEDDING_DIMENSIONS } from '../../domain/entities/common/vector.type';
import { StubTextEmbedding } from './stub-text-embedding';

describe('StubTextEmbedding', () => {
    it('возвращает фиксированный вектор и пометку stub', async () => {
        const embedder = new StubTextEmbedding();
        const first = await embedder.embed('кроссовки');
        const second = await embedder.embed('станок');

        expect(first.stub).toBe(true);
        expect(first.vector).toHaveLength(EMBEDDING_DIMENSIONS);
        expect(first.vector[0]).toBe(1);
        expect(first.vector[1]).toBe(0);
        expect(second.vector).toEqual(first.vector);

        first.vector[0] = 0;

        const third = await embedder.embed('ещё текст');

        expect(third.vector[0]).toBe(1);
    });
});
