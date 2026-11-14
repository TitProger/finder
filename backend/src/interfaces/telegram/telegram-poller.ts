import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { Envs } from '../../common/envs/env';
import { TelegramBotApi } from './telegram-api';
import { TelegramDialog } from './telegram-dialog';
import { toIncoming } from './telegram-update';

/**
 * Long polling. Без токена процесс HTTP всё равно стартует.
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
        if (!Envs.telegram.botToken) {
            this.logger.log('Telegram-бот выключен: нет TELEGRAM_BOT_TOKEN');

            return;
        }

        this.stopped = false;
        void this.loop();
    }

    onModuleDestroy(): void {
        this.stopped = true;
        this.abort?.abort();
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
