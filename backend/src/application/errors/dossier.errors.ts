import { appError } from './types';

export const DossierErrors = {
    notFound: appError('DOSSIER_NOT_FOUND', 'Досье не найдено'),
    notLive: appError('DOSSIER_NOT_LIVE', 'Живое досье не найдено'),
    reportMissing: appError('DOSSIER_REPORT_MISSING', 'У досье нет безопасного отчёта'),
    reviewsIncomplete: appError(
        'DOSSIER_REVIEWS_INCOMPLETE',
        'Перед публикацией нужно подтвердить категорию, оффер и поставщика',
    ),
    reviewRejected: appError('DOSSIER_REVIEW_REJECTED', 'Есть отклонённая часть досье, публиковать нельзя'),
    inquiryReportMissing: appError(
        'DOSSIER_INQUIRY_REPORT_MISSING',
        'По заявке ещё нет безопасного отчёта из живого досье',
    ),
} as const;
