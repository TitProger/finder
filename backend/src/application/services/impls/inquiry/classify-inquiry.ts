import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import {
    ClassificationCandidate,
    ClassificationMatch,
    ClassificationScores,
    PauseOutcome,
} from '../../../../domain/inquiry/classification';
import { displayPhrase, normalizePhrase } from '../../../../domain/text/phrase-text';
import { containsKeywords } from '../../../../domain/text/russian-normalizer';
import { CategoryClassifierPort } from '../../../ports/category-classifier.port';
import { TextEmbeddingPort } from '../../../ports/text-embedding.port';

const TOP_CANDIDATES = 5;

export type PhraseSample = {
    phrase: string;
    categoryId: string;
    categoryName: string;
    categoryStatus: CategoryStatus;
    embedding: number[] | null;
};

export type CategorySample = {
    id: string;
    code: string | null;
    name: string;
    status: CategoryStatus;
    description: string;
    embedding: number[] | null;
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
 * 4. Vector fallback (legacy)
 * 5. Pause (ambiguous or no match)
 */
export async function classifyInquiry(
    text: string,
    phrases: readonly PhraseSample[],
    categories: readonly CategorySample[],
    embeddings: TextEmbeddingPort,
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

    return vectorDecision(activeCategories, activePhrases, embeddings, text);
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

async function vectorDecision(
    categories: readonly CategorySample[],
    phrases: readonly PhraseSample[],
    embeddings: TextEmbeddingPort,
    text: string,
): Promise<ClassificationDecision> {
    const embedded = await embeddings.embed(displayPhrase(text));

    if (embedded.stub) {
        return pause('embedder_stub', true, []);
    }

    const phrasesByCategory = new Map<string, PhraseSample[]>();

    for (const phrase of phrases) {
        const list = phrasesByCategory.get(phrase.categoryId) ?? [];

        list.push(phrase);
        phrasesByCategory.set(phrase.categoryId, list);
    }

    const ranked: ClassificationCandidate[] = [];

    for (const category of categories) {
        const vectors = [
            category.embedding,
            ...(phrasesByCategory.get(category.id) ?? []).map((phrase) => phrase.embedding),
        ];
        const score = bestCosine(embedded.vector, vectors);

        if (score === null) {
            continue;
        }

        ranked.push({
            categoryId: category.id,
            categoryName: category.name,
            score,
            matchedBy: 'vector',
        });
    }

    ranked.sort((left, right) => {
        if (left.score !== right.score) {
            return right.score - left.score;
        }

        return left.categoryName.localeCompare(right.categoryName, 'ru');
    });

    return pause('vector_unresolved', false, ranked.slice(0, TOP_CANDIDATES));
}

function bestCosine(query: number[], vectors: ReadonlyArray<number[] | null | undefined>): number | null {
    let best: number | null = null;

    for (const vector of vectors) {
        if (!vector) {
            continue;
        }

        const score = cosine(query, vector);

        if (score === null) {
            continue;
        }

        if (best === null || score > best) {
            best = score;
        }
    }

    return best;
}

function cosine(left: number[], right: number[]): number | null {
    if (left.length === 0 || left.length !== right.length) {
        return null;
    }

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (let index = 0; index < left.length; index += 1) {
        const leftValue = left[index];
        const rightValue = right[index];

        dot += leftValue * rightValue;
        leftNorm += leftValue * leftValue;
        rightNorm += rightValue * rightValue;
    }

    if (leftNorm === 0 || rightNorm === 0) {
        return null;
    }

    return dot / Math.sqrt(leftNorm * rightNorm);
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
