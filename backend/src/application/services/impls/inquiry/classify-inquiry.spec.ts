import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { CategorySample, classifyInquiry, PhraseSample } from './classify-inquiry';

const shoes: PhraseSample = {
    phrase: 'кроссовки',
    categoryId: 'shoes',
    categoryName: 'Обувь',
    categoryStatus: CategoryStatus.ACTIVE,
};

const clothes: PhraseSample = {
    phrase: 'ткань',
    categoryId: 'clothes',
    categoryName: 'Одежда',
    categoryStatus: CategoryStatus.ACTIVE,
};

const archived: PhraseSample = {
    phrase: 'архив',
    categoryId: 'old',
    categoryName: 'Архив',
    categoryStatus: CategoryStatus.ARCHIVED,
};

function categories(): CategorySample[] {
    return [
        { id: 'shoes', code: null, name: 'Обувь', description: 'Обувь', status: CategoryStatus.ACTIVE },
        { id: 'clothes', code: null, name: 'Одежда', description: 'Одежда', status: CategoryStatus.ACTIVE },
        { id: 'old', code: null, name: 'Архив', description: 'Архив', status: CategoryStatus.ARCHIVED },
    ];
}

describe('classifyInquiry', () => {
    it('точное совпадение фразы выбирает категорию', async () => {
        const decision = await classifyInquiry('  Кроссовки  ', [shoes, clothes], categories());

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
    });

    it('одна и та же фраза в двух категориях ставит паузу', async () => {
        const second = { ...clothes, phrase: 'кроссовки', categoryId: 'clothes', categoryName: 'Одежда' };
        const decision = await classifyInquiry('кроссовки', [shoes, second], categories());

        expect(decision.kind).toBe('pause');

        if (decision.kind !== 'pause') {
            return;
        }

        expect(decision.scores.outcome).toBe('ambiguous_phrase');
        expect(decision.scores.candidates.map((item) => item.categoryId).sort()).toEqual(['clothes', 'shoes']);
    });

    it('фраза архивной категории не выбирает её', async () => {
        const decision = await classifyInquiry('архив', [archived], categories());

        expect(decision.kind).toBe('pause');

        if (decision.kind !== 'pause') {
            return;
        }

        expect(decision.scores.outcome).toBe('no_match');
        expect(decision.scores.candidates).toEqual([]);
    });

    it('неизвестная фраза остаётся без категории', async () => {
        const decision = await classifyInquiry('нужен станок', [shoes], categories());

        expect(decision.kind).toBe('pause');

        if (decision.kind !== 'pause') {
            return;
        }

        expect(decision.scores).toEqual({ outcome: 'no_match', stub: false, candidates: [] });
    });
});
