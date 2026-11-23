import { CommonMessages } from './common.messages';

/**
 * Каталог успешных сообщений API-ответов.
 * В HTTP-сервисах: `AppMessages.common.fetched`.
 */
export const AppMessages = {
    common: CommonMessages,
} as const;

export type { AppMessage } from './types';
export { appMessage } from './types';
