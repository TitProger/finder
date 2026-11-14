import { TelegramIncoming } from './telegram.types';

export type TgUpdate = {
    update_id: number;
    message?: {
        chat: { id: number };
        from?: { id: number };
        text?: string;
        caption?: string;
        photo?: { file_id: string }[];
    };
    callback_query?: {
        id: string;
        from: { id: number };
        message?: { chat: { id: number } };
        data?: string;
    };
};

/** Берёт текст, фото и нажатие кнопки. Остальные апдейты боту не нужны. */
export function toIncoming(update: TgUpdate): TelegramIncoming | null {
    const query = update.callback_query;

    if (query) {
        if (!query.data) {
            return null;
        }

        return {
            kind: 'callback',
            chatId: query.message?.chat.id ?? query.from.id,
            telegramUserId: query.from.id,
            callbackQueryId: query.id,
            data: query.data,
        };
    }

    const message = update.message;

    if (!message?.from) {
        return null;
    }

    const photos = message.photo ?? [];
    const largest = photos.length > 0 ? photos[photos.length - 1]?.file_id : null;

    return {
        kind: 'message',
        chatId: message.chat.id,
        telegramUserId: message.from.id,
        text: message.text ?? message.caption ?? null,
        photoFileIds: largest ? [largest] : [],
    };
}
