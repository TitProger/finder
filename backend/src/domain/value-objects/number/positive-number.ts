import { InvalidNumberAppException } from '../../../common/exceptions/invalid-number.exception';

/**
 * Value Object для положительных чисел.
 *
 * Инкапсулирует положительное целое число (строго больше 0) и обеспечивает валидацию.
 * Используется для полей, которые должны быть строго положительными (page, limit и т.д.).
 */
export class PositiveNumber {
    private constructor(private readonly value: number) {
        if (!this.isValid(value)) {
            throw new InvalidNumberAppException(
                `Некорректное значение: ${value}. Ожидается положительное число (больше 0)`,
                { code: 'INVALID_POSITIVE_NUMBER' },
            );
        }
    }

    /**
     * Создаёт экземпляр PositiveNumber из числа или строки.
     *
     * @param value - значение для создания (число или строка)
     * @param fieldName - имя поля для более информативной ошибки (опционально)
     * @returns экземпляр PositiveNumber
     * @throws InvalidNumberAppException если значение невалидно
     */
    static create(value: unknown, fieldName?: string): PositiveNumber {
        const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;

        try {
            return new PositiveNumber(num);
        } catch (error) {
            if (error instanceof InvalidNumberAppException && fieldName) {
                throw new InvalidNumberAppException(
                    `Некорректное значение поля "${fieldName}": ожидается положительное число (больше 0)`,
                    { code: `INVALID_${fieldName.toUpperCase()}` },
                );
            }

            throw error;
        }
    }

    /**
     * Возвращает числовое значение.
     */
    getValue(): number {
        return this.value;
    }

    /**
     * Возвращает числовое значение (алиас для getValue).
     */
    toNumber(): number {
        return this.value;
    }

    /**
     * Проверяет валидность значения (положительное число).
     *
     * @param value - значение для проверки
     * @returns true если значение валидно
     */
    private isValid(value: unknown): boolean {
        if (typeof value !== 'number') {
            return false;
        }

        if (value <= 0) {
            return false;
        }

        if (isNaN(value) || !isFinite(value)) {
            return false;
        }

        return true;
    }

    /**
     * Сравнивает два PositiveNumber на равенство.
     */
    equals(other: PositiveNumber): boolean {
        return this.value === other.value;
    }

    /**
     * Преобразует в строку.
     */
    toString(): string {
        return String(this.value);
    }
}
