import { BadRequestAppException } from './bad-request.exception';
import { ExceptionContext } from './common/app.exception';

/**
 * Базовое исключение для ошибок пагинации.
 */
export class PaginationAppException extends BadRequestAppException {
    constructor(message = 'Ошибка пагинации', context?: ExceptionContext) {
        super(message, context);
    }
}

/**
 * Некорректные параметры пагинации (page/limit/total и т.п.).
 */
export class InvalidPaginationParamException extends PaginationAppException {
    constructor(message = 'Некорректные параметры пагинации', context?: ExceptionContext) {
        super(message, context);
    }
}

/**
 * Запрошенная страница выходит за пределы диапазона.
 */
export class PaginationPageOutOfRangeException extends PaginationAppException {
    constructor(message = 'Запрошенная страница вне допустимого диапазона', context?: ExceptionContext) {
        super(message, context);
    }
}
