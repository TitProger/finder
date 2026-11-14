import { HttpStatus } from '@nestjs/common';
import { AppException, ExceptionContext } from './common/app.exception';

export class InternalServerAppException extends AppException {
    readonly status = HttpStatus.INTERNAL_SERVER_ERROR;

    constructor(message = 'Внутренняя ошибка сервера', context?: ExceptionContext) {
        super(message, context);
    }
}
