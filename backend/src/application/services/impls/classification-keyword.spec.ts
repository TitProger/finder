import { CategoryStatus } from '../../../domain/enums/category-status.enum';
import { classifyInquiry, CategorySample, PhraseSample } from './inquiry/classify-inquiry';

/**
 * Test keyword/synonym matching for classification.
 * Should match "Нужны лабораторные халаты 1000 шт, хлопок" to clothing category.
 */
describe('Classification: keyword matching', () => {
    const clothingCategory: CategorySample = {
        id: 'cat-clothing',
        code: 'clothing',
        name: 'Одежда',
        description: 'Одежда, текстиль, спецодежда',
        status: CategoryStatus.ACTIVE,
    };

    const autoCategory: CategorySample = {
        id: 'cat-auto',
        code: 'auto',
        name: 'Авто',
        description: 'Автомобили',
        status: CategoryStatus.ACTIVE,
    };

    const clothingPhrases: PhraseSample[] = [
        {
            phrase: 'лабораторные халаты',
            categoryId: 'cat-clothing',
            categoryName: 'Одежда',
            categoryStatus: CategoryStatus.ACTIVE,
        },
        {
            phrase: 'спецодежда',
            categoryId: 'cat-clothing',
            categoryName: 'Одежда',
            categoryStatus: CategoryStatus.ACTIVE,
        },
    ];

    const autoPhrases: PhraseSample[] = [
        {
            phrase: 'автомобиль',
            categoryId: 'cat-auto',
            categoryName: 'Авто',
            categoryStatus: CategoryStatus.ACTIVE,
        },
        {
            phrase: 'Chery Tiggo',
            categoryId: 'cat-auto',
            categoryName: 'Авто',
            categoryStatus: CategoryStatus.ACTIVE,
        },
    ];

    it('should match lab coat request to clothing category by keywords', async () => {
        const decision = await classifyInquiry(
            'Нужны лабораторные халаты 1000 шт, хлопок',
            [...clothingPhrases, ...autoPhrases],
            [clothingCategory, autoCategory],
        );

        expect(decision.kind).toBe('confident');

        if (decision.kind === 'confident') {
            expect(decision.categoryId).toBe('cat-clothing');
        }
    });

    it('should match auto request to auto category', async () => {
        const decision = await classifyInquiry(
            'Нужен автомобиль Chery Tiggo 7 Pro',
            [...clothingPhrases, ...autoPhrases],
            [clothingCategory, autoCategory],
        );

        expect(decision.kind).toBe('confident');

        if (decision.kind === 'confident') {
            expect(decision.categoryId).toBe('cat-auto');
        }
    });

    it('should pause on unrelated text when no keywords match', async () => {
        const decision = await classifyInquiry(
            'Непонятный товар без ключевых слов',
            [...clothingPhrases, ...autoPhrases],
            [clothingCategory, autoCategory],
        );

        expect(decision.kind).toBe('pause');

        if (decision.kind === 'pause') {
            expect(decision.scores.outcome).toBe('no_match');
        }
    });
});
