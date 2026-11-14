/**
 * Port for category classification.
 * Abstracts LLM provider for swappable implementations.
 */

export interface CategoryClassificationRequest {
    text: string;
    categories: CategoryForClassification[];
}

export interface CategoryForClassification {
    code: string;
    name: string;
    description: string;
    examplePhrases: string[];
}

export interface CategoryClassificationResult {
    categoryCode: string | null;
    confidence: number;
    top3: Array<{ categoryCode: string; confidence: number }>;
}

export abstract class CategoryClassifierPort {
    abstract classify(request: CategoryClassificationRequest): Promise<CategoryClassificationResult>;
}
