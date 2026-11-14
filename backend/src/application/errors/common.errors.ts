import { appError } from './types';

export const CommonErrors = {
    notFound: appError('NOT_FOUND', 'Ресурс не найден'),
    emptyFilter: appError('EMPTY_FILTER_QUERY', 'Фильтр поиска не может быть пустым'),
} as const;
