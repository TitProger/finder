import { appError } from './types';

export const ResearchErrors = {
    paused: appError('RESEARCH_INQUIRY_PAUSED', 'Заявка на паузе, досье не принимается'),
    noCategory: appError('RESEARCH_INQUIRY_NO_CATEGORY', 'У заявки нет категории, досье не принимается'),
    notOpen: appError('RESEARCH_INQUIRY_NOT_OPEN', 'Заявка в этом статусе досье не принимает'),
    dossierShape: appError('RESEARCH_DOSSIER_SHAPE', 'Досье не разобрано'),
    duplicate: appError('RESEARCH_DOSSIER_DUPLICATE', 'Компания или витрина уже есть в базе'),
    runReused: appError('RUN_ID_REUSED', 'Этот run_id уже принят с другим телом'),
    categoryMismatch: appError('RESEARCH_CATEGORY_MISMATCH', 'Категория досье не совпала с категорией заявки'),
    rerunNotAllowed: appError('RESEARCH_RERUN_NOT_ALLOWED', 'Эту заявку нельзя отправить на ресерч повторно'),
    runNotFound: appError('RESEARCH_RUN_NOT_FOUND', 'Прогон ресерча не найден'),
    noFactoryOffer: appError(
        'RESEARCH_NO_FACTORY_OFFER',
        'В досье нет заводского оффера. Карточку можно собрать позже.',
    ),
} as const;
