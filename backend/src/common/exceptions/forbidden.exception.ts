import { HttpStatus } from '@nestjs/common';
import { AppException, ExceptionContext } from './common/app.exception';

export class ForbiddenAppException extends AppException {
    readonly status = HttpStatus.FORBIDDEN;

    constructor(message = 'Доступ запрещен', context?: ExceptionContext) {
        super(message, context);
    }
}
