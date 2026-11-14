import { BadRequestAppException } from './bad-request.exception';
import { ExceptionContext } from './common/app.exception';

/**
 * Исключение для некорректных числовых значений.
 *
 * Используется в value objects для чисел (PositiveNumber, NonNegativeNumber и т.п.).
 */
export class InvalidNumberAppException extends BadRequestAppException {
    constructor(message = 'Некорректное числовое значение', context?: ExceptionContext) {
        super(message, context);
    }
}
