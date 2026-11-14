import { HttpStatus } from '@nestjs/common';
import { AppException, ExceptionContext } from './common/app.exception';

export class BadRequestAppException extends AppException {
    readonly status = HttpStatus.BAD_REQUEST;

    constructor(message = 'Некорректные данные', context?: ExceptionContext) {
        super(message, context);
    }
}
