import { appMessage } from './types';

/** Общие CRUD-сообщения (когда нет сущности в контексте). */
export const CommonMessages = {
    listed: appMessage('Список получен'),
    fetched: appMessage('Данные получены'),
    created: appMessage('Создано'),
    updated: appMessage('Обновлено'),
    deleted: appMessage('Удалено'),
} as const;
