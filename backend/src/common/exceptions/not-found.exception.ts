import { HttpStatus } from '@nestjs/common';
import { AppException, ExceptionContext } from './common/app.exception';

export class NotFoundAppException extends AppException {
    readonly status = HttpStatus.NOT_FOUND;

    constructor(message = 'Ресурс не найден', context?: ExceptionContext) {
        super(message, context);
    }
}
