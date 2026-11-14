import { Type } from '@mikro-orm/core';

/** pgvector column vector(1536). JS-сторона — number[]. */
export class VectorType extends Type<number[] | null, string | null> {
    constructor(private readonly dimensions = 1536) {
        super();
    }

    convertToDatabaseValue(value: number[] | null): string | null {
        if (value == null) {
            return null;
        }

        return `[${value.join(',')}]`;
    }

    convertToJSValue(value: string | number[] | null): number[] | null {
        if (value == null) {
            return null;
        }

        if (Array.isArray(value)) {
            return value.map(Number);
        }

        const trimmed = value.trim();

        if (trimmed === '' || trimmed === '[]') {
            return [];
        }

        return trimmed
            .replace(/^\[/, '')
            .replace(/]$/, '')
            .split(',')
            .map((part) => Number(part.trim()));
    }

    getColumnType(): string {
        return `vector(${this.dimensions})`;
    }
}

export const EMBEDDING_DIMENSIONS = 1536;
