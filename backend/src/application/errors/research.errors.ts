import { appError } from './types';

export const ResearchErrors = {
    paused: appError('RESEARCH_INQUIRY_PAUSED', 'Заявка на паузе, досье не принимается'),
    noCategory: appError('RESEARCH_INQUIRY_NO_CATEGORY', 'У заявки нет категории, досье не принимается'),
    notOpen: appError('RESEARCH_INQUIRY_NOT_OPEN', 'Заявка в этом статусе досье не принимает'),
    dossierShape: appError('RESEARCH_DOSSIER_SHAPE', 'Досье не разобрано'),
    duplicate: appError('RESEARCH_DOSSIER_DUPLICATE', 'Компания или витрина уже есть в базе'),
} as const;
