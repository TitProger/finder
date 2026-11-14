import { CategoryStatus } from '../../../domain/enums/category-status.enum';
import { classifyInquiry, CategorySample, PhraseSample } from './inquiry/classify-inquiry';
import { CategoryClassifierPort, CategoryClassificationResult } from '../../../application/ports/category-classifier.port';

class MockLlmClassifier extends CategoryClassifierPort {
    constructor(private result: CategoryClassificationResult) {
        super();
    }

    async classify(): Promise<CategoryClassificationResult> {
        return this.result;
    }
}

/**
 * Test LLM classification fallback.
 * Should handle no-key gracefully and use LLM when confident.
 */
describe('Classification: LLM fallback', () => {
    const clothingCategory: CategorySample = {
        id: 'cat-clothing',
        code: 'clothing',
        name: 'Одежда',
        description: 'Одежда, текстиль, спецодежда',
        status: CategoryStatus.ACTIVE,
    };

    const phrases: PhraseSample[] = [
        {
            phrase: 'точная фраза',
            categoryId: 'cat-clothing',
            categoryName: 'Одежда',
            categoryStatus: CategoryStatus.ACTIVE,
        },
    ];

    it('should use LLM when confident', async () => {
        const mockLlm = new MockLlmClassifier({
            categoryCode: 'clothing',
            confidence: 0.95,
            top3: [{ categoryCode: 'clothing', confidence: 0.95 }],
        });

        const decision = await classifyInquiry(
            'Непонятный текст, но LLM уверена',
            phrases,
            [clothingCategory],
            mockLlm,
            0.7,
        );

        expect(decision.kind).toBe('confident');

        if (decision.kind === 'confident') {
            expect(decision.categoryId).toBe('cat-clothing');
            expect(decision.scores.outcome).toBe('llm_confident');
        }
    });

    it('should pause when LLM confidence is low', async () => {
        const mockLlm = new MockLlmClassifier({
            categoryCode: 'clothing',
            confidence: 0.5,
            top3: [{ categoryCode: 'clothing', confidence: 0.5 }],
        });

        const decision = await classifyInquiry(
            'Непонятный текст, LLM не уверена',
            phrases,
            [clothingCategory],
            mockLlm,
            0.7,
        );

        expect(decision.kind).toBe('pause');

        if (decision.kind === 'pause') {
            expect(decision.scores.outcome).toBe('llm_low_confidence');
        }
    });

    it('should fallback to pause when no LLM available', async () => {
        const decision = await classifyInquiry(
            'Непонятный текст без LLM',
            phrases,
            [clothingCategory],
            undefined,
            0.7,
        );

        expect(decision.kind).toBe('pause');

        if (decision.kind === 'pause') {
            expect(decision.scores.outcome).toBe('no_match');
        }
    });
});
