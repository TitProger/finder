import { appError } from './types';

export const AuthErrors = {
    userInactive: appError('USER_INACTIVE', 'Учётная запись неактивна'),
    unauthorized: appError('UNAUTHORIZED', 'Требуется авторизация'),
    forbidden: appError('FORBIDDEN', 'Недостаточно прав'),
} as const;
