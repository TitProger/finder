import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { Envs } from '../../common/envs/env';
import { TelegramBotApi } from './telegram-api';
import { telegramIntake } from './telegram-intake';
import { TelegramDialog } from './telegram-dialog';
import { toIncoming } from './telegram-update';

/**
 * Long polling, если нет TELEGRAM_WEBHOOK_URL. Домен для бота не нужен.
 * Без токена процесс HTTP всё равно стартует.
 */
@Injectable()
export class TelegramPoller implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(TelegramPoller.name);
    private stopped = false;
    private abort: AbortController | null = null;

    constructor(
        private readonly api: TelegramBotApi,
        private readonly dialog: TelegramDialog,
    ) {}

    onApplicationBootstrap(): void {
        const mode = telegramIntake({
            token: Envs.telegram.botToken,
            polling: process.env.TELEGRAM_POLLING,
            webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
        });

        if (mode === 'off') {
            this.logger.log('Telegram-бот выключен: нет TELEGRAM_BOT_TOKEN');

            return;
        }

        if (mode === 'skip') {
            this.logger.log('Telegram long polling пропущен');

            return;
        }

        if (mode === 'webhook') {
            this.logger.log('Задан TELEGRAM_WEBHOOK_URL, long polling не запускается');

            return;
        }

        this.stopped = false;
        void this.start();
    }

    onModuleDestroy(): void {
        this.stopped = true;
        this.abort?.abort();
    }

    private async start(): Promise<void> {
        try {
            await this.api.deleteWebhook();
        } catch (error) {
            if (this.stopped) {
                return;
            }

            this.logger.error(this.safe(error));
        }

        await this.loop();
    }

    private async loop(): Promise<void> {
        let offset = 0;

        while (!this.stopped) {
            this.abort = new AbortController();

            try {
                const updates = await this.api.getUpdates(offset, this.abort.signal);

                for (const update of updates) {
                    const incoming = toIncoming(update);

                    if (incoming) {
                        try {
                            await this.dialog.handle(incoming);
                        } catch (error) {
                            this.logger.error(this.safe(error));
                        }
                    }

                    offset = update.update_id + 1;
                }
            } catch (error) {
                if (this.stopped) {
                    return;
                }

                this.logger.error(this.safe(error));
                await delay(2000);
            }
        }
    }

    private safe(error: unknown): string {
        const message = error instanceof Error ? error.message : 'ошибка Telegram';
        const token = Envs.telegram.botToken;

        if (!token) {
            return message;
        }

        return message.split(token).join('***');
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
