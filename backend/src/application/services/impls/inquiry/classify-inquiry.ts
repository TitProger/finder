import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import {
    ClassificationCandidate,
    ClassificationMatch,
    ClassificationScores,
    PauseOutcome,
} from '../../../../domain/inquiry/classification';
import { normalizePhrase } from '../../../../domain/text/phrase-text';
import { containsKeywords } from '../../../../domain/text/russian-normalizer';
import { CategoryClassifierPort } from '../../../ports/category-classifier.port';

export type PhraseSample = {
    phrase: string;
    categoryId: string;
    categoryName: string;
    categoryStatus: CategoryStatus;
};

export type CategorySample = {
    id: string;
    code: string | null;
    name: string;
    status: CategoryStatus;
    description: string;
};

export type ClassificationDecision =
    | {
          kind: 'confident';
          categoryId: string;
          scores: ClassificationScores;
      }
    | {
          kind: 'pause';
          scores: ClassificationScores & { outcome: PauseOutcome };
      };

/**
 * Classification flow:
 * 1. Exact phrase match (active categories)
 * 2. Keyword/synonym matching (substring, word-form tolerant)
 * 3. LLM classification (if configured and confident)
 * 4. Pause when nothing matched
 */
export async function classifyInquiry(
    text: string,
    phrases: readonly PhraseSample[],
    categories: readonly CategorySample[],
    llmClassifier?: CategoryClassifierPort,
    llmConfidenceThreshold = 0.7,
): Promise<ClassificationDecision> {
    const activePhrases = phrases.filter((phrase) => phrase.categoryStatus === CategoryStatus.ACTIVE);
    const normalized = normalizePhrase(text);
    const hits = new Map<string, PhraseSample>();

    for (const phrase of activePhrases) {
        if (normalizePhrase(phrase.phrase) !== normalized) {
            continue;
        }

        if (!hits.has(phrase.categoryId)) {
            hits.set(phrase.categoryId, phrase);
        }
    }

    const matched = [...hits.values()].sort((left, right) => left.categoryName.localeCompare(right.categoryName, 'ru'));

    if (matched.length === 1) {
        return confident(matched[0]);
    }

    if (matched.length > 1) {
        return pause(
            'ambiguous_phrase',
            false,
            matched.map((phrase) => candidate(phrase, 1, 'exact_phrase')),
        );
    }

    const activeCategories = categories.filter((category) => category.status === CategoryStatus.ACTIVE);

    const keywordMatches = keywordMatchCategories(text, activePhrases, activeCategories);

    if (keywordMatches.length === 1) {
        return {
            kind: 'confident',
            categoryId: keywordMatches[0].categoryId,
            scores: {
                outcome: 'keyword_match',
                stub: false,
                candidates: [keywordMatches[0]],
            },
        };
    }

    if (keywordMatches.length > 1) {
        return pause('ambiguous_keyword', false, keywordMatches);
    }

    if (llmClassifier) {
        const llmDecision = await llmClassification(text, activeCategories, llmClassifier, llmConfidenceThreshold);

        if (llmDecision) {
            return llmDecision;
        }
    }

    return pause('no_match', false, []);
}

function confident(phrase: PhraseSample): ClassificationDecision {
    return {
        kind: 'confident',
        categoryId: phrase.categoryId,
        scores: {
            outcome: 'exact_phrase',
            stub: false,
            candidates: [candidate(phrase, 1, 'exact_phrase')],
        },
    };
}

function pause(outcome: PauseOutcome, stub: boolean, candidates: ClassificationCandidate[]): ClassificationDecision {
    return {
        kind: 'pause',
        scores: { outcome, stub, candidates },
    };
}

function candidate(
    phrase: PhraseSample,
    score: number,
    matchedBy: ClassificationCandidate['matchedBy'],
): ClassificationCandidate {
    return {
        categoryId: phrase.categoryId,
        categoryName: phrase.categoryName,
        score,
        matchedBy,
    };
}

function keywordMatchCategories(
    text: string,
    phrases: readonly PhraseSample[],
    _categories: readonly CategorySample[],
): ClassificationCandidate[] {
    const matchedCategories = new Map<string, ClassificationCandidate>();

    for (const phrase of phrases) {
        if (matchedCategories.has(phrase.categoryId)) {
            continue;
        }

        const phraseKeywords = phrase.phrase.split(/\s+/).filter((word) => word.length > 2);

        if (containsKeywords(text, phraseKeywords)) {
            matchedCategories.set(phrase.categoryId, {
                categoryId: phrase.categoryId,
                categoryName: phrase.categoryName,
                score: 0.9,
                matchedBy: 'keyword',
            });
        }
    }

    return [...matchedCategories.values()].sort((left, right) =>
        left.categoryName.localeCompare(right.categoryName, 'ru'),
    );
}

async function llmClassification(
    text: string,
    categories: readonly CategorySample[],
    llmClassifier: CategoryClassifierPort,
    confidenceThreshold: number,
): Promise<ClassificationDecision | null> {
    try {
        const categoriesWithCode = categories.filter((cat) => cat.code);

        if (categoriesWithCode.length === 0) {
            return null;
        }

        const result = await llmClassifier.classify({
            text,
            categories: categoriesWithCode.map((cat) => ({
                code: cat.code!,
                name: cat.name,
                description: cat.description,
                examplePhrases: [],
            })),
        });

        if (result.categoryCode && result.confidence >= confidenceThreshold) {
            const matchedCategory = categoriesWithCode.find((cat) => cat.code === result.categoryCode);

            if (matchedCategory) {
                return {
                    kind: 'confident',
                    categoryId: matchedCategory.id,
                    scores: {
                        outcome: 'llm_confident',
                        stub: false,
                        candidates: [
                            {
                                categoryId: matchedCategory.id,
                                categoryName: matchedCategory.name,
                                score: result.confidence,
                                matchedBy: 'llm',
                            },
                        ],
                    },
                };
            }
        }

        if (result.top3.length > 0) {
            const top3Candidates: ClassificationCandidate[] = result.top3
                .map((item) => {
                    const cat = categoriesWithCode.find((c) => c.code === item.categoryCode);

                    return cat
                        ? {
                              categoryId: cat.id,
                              categoryName: cat.name,
                              score: item.confidence,
                              matchedBy: 'llm' as ClassificationMatch,
                          }
                        : null;
                })
                .filter((item): item is ClassificationCandidate => item !== null);

            return pause('llm_low_confidence', false, top3Candidates);
        }

        return null;
    } catch (_error) {
        return null;
    }
}
