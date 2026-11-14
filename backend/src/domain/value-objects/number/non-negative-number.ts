import { InvalidNumberAppException } from '../../../common/exceptions/invalid-number.exception';

/**
 * Value Object для неотрицательных чисел.
 *
 * Инкапсулирует неотрицательное целое число (>= 0) и обеспечивает валидацию.
 * Используется для полей, которые могут быть нулём или положительными (total, count и т.д.).
 */
export class NonNegativeNumber {
    private constructor(private readonly value: number) {
        if (!this.isValid(value)) {
            throw new InvalidNumberAppException(
                `Некорректное значение: ${value}. Ожидается неотрицательное число (>= 0)`,
                { code: 'INVALID_NON_NEGATIVE_NUMBER' },
            );
        }
    }

    /**
     * Создаёт экземпляр NonNegativeNumber из числа или строки.
     *
     * @param value - значение для создания (число или строка)
     * @param fieldName - имя поля для более информативной ошибки (опционально)
     * @returns экземпляр NonNegativeNumber
     * @throws InvalidNumberAppException если значение невалидно
     */
    static create(value: unknown, fieldName?: string): NonNegativeNumber {
        const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;

        try {
            return new NonNegativeNumber(num);
        } catch (error) {
            if (error instanceof InvalidNumberAppException && fieldName) {
                throw new InvalidNumberAppException(
                    `Некорректное значение поля "${fieldName}": ожидается неотрицательное число (>= 0)`,
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
     * Проверяет валидность значения (неотрицательное число).
     *
     * @param value - значение для проверки
     * @returns true если значение валидно
     */
    private isValid(value: unknown): boolean {
        if (typeof value !== 'number') {
            return false;
        }

        if (value < 0) {
            return false;
        }

        if (isNaN(value) || !isFinite(value)) {
            return false;
        }

        return true;
    }

    /**
     * Сравнивает два NonNegativeNumber на равенство.
     */
    equals(other: NonNegativeNumber): boolean {
        return this.value === other.value;
    }

    /**
     * Преобразует в строку.
     */
    toString(): string {
        return String(this.value);
    }
}
