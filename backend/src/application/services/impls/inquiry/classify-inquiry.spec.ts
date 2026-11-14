import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { TextEmbeddingPort } from '../../../ports/text-embedding.port';
import { CategorySample, classifyInquiry, PhraseSample } from './classify-inquiry';

const shoes: PhraseSample = {
    phrase: 'кроссовки',
    categoryId: 'shoes',
    categoryName: 'Обувь',
    categoryStatus: CategoryStatus.ACTIVE,
    embedding: null,
};

const clothes: PhraseSample = {
    phrase: 'ткань',
    categoryId: 'clothes',
    categoryName: 'Одежда',
    categoryStatus: CategoryStatus.ACTIVE,
    embedding: null,
};

const archived: PhraseSample = {
    phrase: 'архив',
    categoryId: 'old',
    categoryName: 'Архив',
    categoryStatus: CategoryStatus.ARCHIVED,
    embedding: [1, 0],
};

function categories(): CategorySample[] {
    return [
        { id: 'shoes', name: 'Обувь', status: CategoryStatus.ACTIVE, embedding: [1, 0] },
        { id: 'clothes', name: 'Одежда', status: CategoryStatus.ACTIVE, embedding: [0, 1] },
        { id: 'old', name: 'Архив', status: CategoryStatus.ARCHIVED, embedding: [1, 0] },
    ];
}

function embedder(stub: boolean): TextEmbeddingPort & { calls: number } {
    return {
        calls: 0,
        async embed() {
            this.calls += 1;

            return { vector: [1, 0], stub };
        },
    };
}

describe('classifyInquiry', () => {
    it('точное совпадение фразы выбирает категорию и не зовёт эмбеддинг', async () => {
        const port = embedder(true);
        const decision = await classifyInquiry('  Кроссовки  ', [shoes, clothes], categories(), port);

        expect(decision.kind).toBe('confident');

        if (decision.kind !== 'confident') {
            return;
        }

        expect(decision.categoryId).toBe('shoes');
        expect(decision.scores.outcome).toBe('exact_phrase');
        expect(decision.scores.stub).toBe(false);
        expect(decision.scores.candidates).toEqual([
            { categoryId: 'shoes', categoryName: 'Обувь', score: 1, matchedBy: 'exact_phrase' },
        ]);
        expect(port.calls).toBe(0);
    });

    it('одна и та же фраза в двух категориях ставит паузу', async () => {
        const port = embedder(true);
        const second = { ...clothes, phrase: 'кроссовки', categoryId: 'clothes', categoryName: 'Одежда' };
        const decision = await classifyInquiry('кроссовки', [shoes, second], categories(), port);

        expect(decision.kind).toBe('pause');

        if (decision.kind !== 'pause') {
            return;
        }

        expect(decision.scores.outcome).toBe('ambiguous_phrase');
        expect(decision.scores.candidates.map((item) => item.categoryId).sort()).toEqual(['clothes', 'shoes']);
        expect(port.calls).toBe(0);
    });

    it('фраза архивной категории не выбирает её', async () => {
        const port = embedder(true);
        const decision = await classifyInquiry('архив', [archived], categories(), port);

        expect(decision.kind).toBe('pause');

        if (decision.kind !== 'pause') {
            return;
        }

        expect(decision.scores.outcome).toBe('embedder_stub');
        expect(port.calls).toBe(1);
    });

    it('неизвестная фраза при заглушке остаётся без категории', async () => {
        const port = embedder(true);
        const decision = await classifyInquiry('нужен станок', [shoes], categories(), port);

        expect(decision.kind).toBe('pause');

        if (decision.kind !== 'pause') {
            return;
        }

        expect(decision.scores).toEqual({ outcome: 'embedder_stub', stub: true, candidates: [] });
        expect(port.calls).toBe(1);
    });

    it('вектор без порога не назначает категорию, даже если косинус высокий', async () => {
        const port = embedder(false);
        const decision = await classifyInquiry('насос', [shoes], categories(), port);

        expect(decision.kind).toBe('pause');

        if (decision.kind !== 'pause') {
            return;
        }

        expect(decision.scores.outcome).toBe('vector_unresolved');
        expect(decision.scores.stub).toBe(false);
        expect(decision.scores.candidates[0]).toMatchObject({ categoryId: 'shoes', matchedBy: 'vector' });
        expect(decision.scores.candidates.some((item) => item.categoryId === 'old')).toBe(false);
        expect(port.calls).toBe(1);
    });
});
