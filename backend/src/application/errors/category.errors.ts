import { appError } from './types';

export const CategoryErrors = {
    notFound: appError('CATEGORY_NOT_FOUND', 'Категория не найдена'),
    notActive: appError('CATEGORY_NOT_ACTIVE', 'Категория архивная и не назначается на заявку'),
    phraseNotFound: appError('CATEGORY_PHRASE_NOT_FOUND', 'Фраза категории не найдена'),
    packNotFound: appError('QUESTION_PACK_NOT_FOUND', 'Пакет вопросов не найден'),
    questionNotFound: appError('CATEGORY_QUESTION_NOT_FOUND', 'Вопрос категории не найден'),
    siteNotFound: appError('CATEGORY_SITE_NOT_FOUND', 'Площадка категории не найдена'),
    nameConflict: appError('CATEGORY_NAME_CONFLICT', 'Категория с таким именем уже есть'),
    phraseConflict: appError('CATEGORY_PHRASE_CONFLICT', 'Такая фраза уже есть в категории'),
    packCodeConflict: appError('QUESTION_PACK_CODE_CONFLICT', 'Код пакета уже занят в категории'),
} as const;
