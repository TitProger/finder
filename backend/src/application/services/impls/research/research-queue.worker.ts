import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Logger } from '../../../../common/logger/logger';
import { RESEARCH_QUEUE_SERVICE, ResearchQueueService } from '../../contracts/research/research-queue.service';

/**
 * Цикл очереди Postgres. Интервал RESEARCH_QUEUE_POLL_MS; 0 — выкл (тесты).
 */
@Injectable()
export class ResearchQueueWorker implements OnModuleInit, OnModuleDestroy {
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        @Inject(RESEARCH_QUEUE_SERVICE)
        private readonly queue: ResearchQueueService,
    ) {}

    onModuleInit(): void {
        const ms = readPollMs();

        if (ms <= 0) {
            return;
        }

        this.timer = setInterval(() => {
            void this.queue.processNext(new Date()).catch((error: unknown) => {
                Logger.error('Цикл очереди ресерча упал', Logger.statuses.FAIL, {
                    data: { message: error instanceof Error ? error.message : String(error) },
                });
            });
        }, ms);
        this.timer.unref?.();
    }

    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

function readPollMs(): number {
    const raw = process.env.RESEARCH_QUEUE_POLL_MS;

    if (raw === undefined || raw.trim() === '') {
        return 2000;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
        return 2000;
    }

    return Math.floor(value);
}
