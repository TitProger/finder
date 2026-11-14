export const CLASSIFICATION_OUTCOMES = [
    'exact_phrase',
    'ambiguous_phrase',
    'embedder_stub',
    'vector_unresolved',
] as const;

export type ClassificationOutcome = (typeof CLASSIFICATION_OUTCOMES)[number];

export type PauseOutcome = Exclude<ClassificationOutcome, 'exact_phrase'>;

export type ClassificationMatch = 'exact_phrase' | 'vector';

export type ClassificationCandidate = {
    categoryId: string;
    categoryName: string;
    score: number;
    matchedBy: ClassificationMatch;
};

/** Оценка классификатора. Лежит в inquiry.classification_scores. */
export type ClassificationScores = {
    outcome: ClassificationOutcome;
    stub: boolean;
    candidates: ClassificationCandidate[];
};
