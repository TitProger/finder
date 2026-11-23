import { appError } from './types';

export const FileErrors = {
    fileRequired: appError('FILE_REQUIRED', 'Нужно поле file'),
    unsupportedType: appError('UNSUPPORTED_FILE_TYPE', 'Допустимы только jpg, jpeg, png, webp'),
    tooLarge: appError('FILE_TOO_LARGE', 'Файл больше 8 МБ'),
    mediaNotFound: appError('MEDIA_NOT_FOUND', 'Файл из mediaIds не найден в хранилище'),
    mediaDuplicate: appError('MEDIA_DUPLICATE', 'mediaIds содержат повтор'),
} as const;
