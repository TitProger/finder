import { HttpStatus } from '@nestjs/common';
import { AppException, ExceptionContext } from './common/app.exception';

export class UnauthorizedAppException extends AppException {
    readonly status = HttpStatus.UNAUTHORIZED;

    constructor(message = 'Требуется авторизация', context?: ExceptionContext) {
        super(message, context);
    }
}
