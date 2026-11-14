import { appError } from './types';

export const AuthErrors = {
    invalidCredentials: appError('INVALID_CREDENTIALS', 'Неверный логин или пароль'),
    userInactive: appError('USER_INACTIVE', 'Учётная запись неактивна'),
    invalidRefreshToken: appError('INVALID_REFRESH_TOKEN', 'Недействительный refresh-токен'),
    unauthorized: appError('UNAUTHORIZED', 'Требуется авторизация'),
    forbidden: appError('FORBIDDEN', 'Недостаточно прав'),
} as const;
