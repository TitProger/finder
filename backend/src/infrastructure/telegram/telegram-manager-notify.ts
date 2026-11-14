import { Inject, Injectable } from '@nestjs/common';

import { ManagerButton, ManagerNotifyPort } from '../../application/ports/manager-notify.port';
import { TELEGRAM_OUTBOUND, TelegramOutbound } from '../../interfaces/telegram/telegram.types';
import { splitTelegramText } from './telegram-text';

/**
 * Шлёт текст админу и повторяет попытку, если Telegram не ответил.
 * Длинный текст режется. Кнопки только у первой части.
 */
@Injectable()
export class TelegramManagerNotify implements ManagerNotifyPort {
    constructor(
        @Inject(TELEGRAM_OUTBOUND)
        private readonly outbound: TelegramOutbound,
    ) {}

    async send(chatId: number, text: string, buttons?: ManagerButton[][]): Promise<void> {
        const chunks = splitTelegramText(text);

        for (let index = 0; index < chunks.length; index += 1) {
            await this.deliverWithRetry({
                method: 'sendMessage',
                chatId,
                text: chunks[index],
                buttons: index === 0 ? buttons : undefined,
            });
        }
    }

    private async deliverWithRetry(message: {
        method: 'sendMessage';
        chatId: number;
        text: string;
        buttons?: ManagerButton[][];
    }): Promise<void> {
        const attempts = readInt('MANAGER_NOTIFY_MAX_ATTEMPTS', 3);
        const delayMs = readInt('MANAGER_NOTIFY_RETRY_DELAY_MS', 200);
        let last: unknown;

        for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
            try {
                await this.outbound.deliver(message);

                return;
            } catch (error) {
                last = error;

                if (attempt < attempts) {
                    await sleep(delayMs * attempt);
                }
            }
        }

        const messageText = last instanceof Error ? last.message : 'Telegram не принял сообщение';

        throw new Error(messageText);
    }
}

function readInt(name: string, fallback: number): number {
    const raw = process.env[name];

    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
        return fallback;
    }

    return Math.floor(value);
}

function sleep(ms: number): Promise<void> {
    if (ms <= 0) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
