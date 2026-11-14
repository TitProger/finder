/** Результат порта эмбеддинга. stub=true — вектор нельзя считать уверенным совпадением. */
export type TextEmbedding = {
    vector: number[];
    stub: boolean;
};

export interface TextEmbeddingPort {
    embed(text: string): Promise<TextEmbedding>;
}

export const TEXT_EMBEDDING_PORT = Symbol('TEXT_EMBEDDING_PORT');
