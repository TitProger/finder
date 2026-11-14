export type TelegramButton = {
    text: string;
    callbackData: string;
};

export type TelegramOutgoing =
    | { method: 'sendMessage'; chatId: number; text: string; buttons?: TelegramButton[][] }
    | { method: 'sendPhoto'; chatId: number; fileId: string }
    | { method: 'answerCallbackQuery'; callbackQueryId: string; text?: string };

export type TelegramIncoming =
    | {
          kind: 'message';
          chatId: number;
          telegramUserId: number;
          text: string | null;
          photoFileIds: string[];
      }
    | {
          kind: 'callback';
          chatId: number;
          telegramUserId: number;
          callbackQueryId: string;
          data: string;
      };

export const TELEGRAM_OUTBOUND = Symbol('TELEGRAM_OUTBOUND');

export interface TelegramOutbound {
    deliver(message: TelegramOutgoing): Promise<void>;
}
