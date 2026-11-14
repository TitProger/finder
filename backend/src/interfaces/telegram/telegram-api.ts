import { Injectable } from '@nestjs/common';

import { Envs } from '../../common/envs/env';
import { TelegramOutgoing, TelegramOutbound } from './telegram.types';
import { TgUpdate } from './telegram-update';

/**
 * Вызовы Bot API. Токен только из env и в лог не попадает.
 */
@Injectable()
export class TelegramBotApi implements TelegramOutbound {
    async getUpdates(offset: number, signal: AbortSignal): Promise<TgUpdate[]> {
        const result = await this.call(
            'getUpdates',
            {
                offset,
                timeout: 25,
                allowed_updates: ['message', 'callback_query'],
            },
            signal,
        );

        return Array.isArray(result) ? (result as TgUpdate[]) : [];
    }

    async deliver(message: TelegramOutgoing): Promise<void> {
        if (message.method === 'sendMessage') {
            await this.call('sendMessage', {
                chat_id: message.chatId,
                text: message.text,
                reply_markup: message.buttons
                    ? {
                          inline_keyboard: message.buttons.map((row) =>
                              row.map((button) => ({
                                  text: button.text,
                                  callback_data: button.callbackData,
                              })),
                          ),
                      }
                    : undefined,
            });

            return;
        }

        if (message.method === 'sendPhoto') {
            await this.call('sendPhoto', {
                chat_id: message.chatId,
                photo: message.fileId,
            });

            return;
        }

        await this.call('answerCallbackQuery', {
            callback_query_id: message.callbackQueryId,
            text: message.text,
        });
    }

    private async call(method: string, body: object, signal?: AbortSignal): Promise<unknown> {
        const token = Envs.telegram.botToken;

        if (!token) {
            throw new Error('TELEGRAM_BOT_TOKEN пустой');
        }

        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        });
        const payload = (await response.json()) as { ok?: boolean; description?: string; result?: unknown };

        if (!payload.ok) {
            throw new Error(payload.description || `Telegram ${method} не ответил`);
        }

        return payload.result;
    }
}
