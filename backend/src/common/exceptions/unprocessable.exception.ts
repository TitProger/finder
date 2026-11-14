import { HttpStatus } from '@nestjs/common';
import { AppException, ExceptionContext } from './common/app.exception';

export class UnprocessableAppException extends AppException {
    readonly status = HttpStatus.UNPROCESSABLE_ENTITY;

    constructor(message = 'Данные не приняты', context?: ExceptionContext) {
        super(message, context);
    }
}
