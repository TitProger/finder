import { appError } from './types';

export const TaxonomyErrors = {
    notFound: appError('TAXONOMY_NODE_NOT_FOUND', 'Узел таксономии не найден'),
    invalidNode: appError('TAXONOMY_NODE_INVALID', 'Неизвестный узел таксономии'),
} as const;
