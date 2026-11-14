import { Type } from '@mikro-orm/core';

export interface ValueObjectTypeOptions<TValue, DBType = string> {
    factory: (value: DBType) => TValue;
    /**
     * Функция для конвертации Value Object в значение для БД.
     * По умолчанию пытаемся сохранить как есть (актуально для string).
     */
    toDatabaseValue?: (value: TValue) => DBType;
    /**
     * Название типа колонки в БД (varchar(255) по умолчанию).
     */
    columnType?: string;
    /**
     * Кастомная функция сравнения (используется MikroORM для dirty checking).
     */
    compare?: (a: TValue, b: TValue) => boolean;
}

/**
 * Универсальный кастомный тип MikroORM для Value Objects.
 * Позволяет хранить как строковые, так и числовые VO без отдельных типовых классов.
 */
export class ValueObjectType<TValue, DBType = string> extends Type<TValue | undefined, DBType | undefined> {
    constructor(private readonly options: ValueObjectTypeOptions<TValue, DBType>) {
        super();
    }

    convertToDatabaseValue(value: TValue | undefined): DBType | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        if (this.options.toDatabaseValue) {
            return this.options.toDatabaseValue(value);
        }

        return value as unknown as DBType;
    }

    convertToJSValue(value: DBType | TValue | undefined): TValue | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }

        if (typeof value === 'object' && 'toString' in value) {
            return value as TValue;
        }

        return this.options.factory(value as DBType);
    }

    compareItems(a: TValue, b: TValue): boolean {
        if (this.options.compare) {
            return this.options.compare(a, b);
        }

        const left = this.convertToDatabaseValue(a);
        const right = this.convertToDatabaseValue(b);

        return JSON.stringify(left) === JSON.stringify(right);
    }

    getColumnType(): string {
        return this.options.columnType ?? 'varchar(255)';
    }
}
