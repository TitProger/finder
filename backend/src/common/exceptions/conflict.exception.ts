import { HttpStatus } from '@nestjs/common';
import { AppException, ExceptionContext } from './common/app.exception';

export class ConflictAppException extends AppException {
    readonly status = HttpStatus.CONFLICT;

    constructor(message = 'Конфликт данных', context?: ExceptionContext) {
        super(message, context);
    }
}
