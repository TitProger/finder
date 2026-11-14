import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Logger } from '../../../../common/logger/logger';
import { RESEARCH_LAUNCH_SERVICE, ResearchLaunchService } from './research-launch.service';

/**
 * Периодически помечает прогоны без досье. Интервал и порог — в env.
 * 0 минут проверки выключает таймер (удобно в тестах процесса).
 */
@Injectable()
export class ResearchStaleScheduler implements OnModuleInit, OnModuleDestroy {
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        @Inject(RESEARCH_LAUNCH_SERVICE)
        private readonly launch: ResearchLaunchService,
    ) {}

    onModuleInit(): void {
        const minutes = readCheckMinutes();

        if (minutes <= 0) {
            return;
        }

        this.timer = setInterval(() => {
            void this.launch.markStale(new Date()).catch((error: unknown) => {
                Logger.error('Проверка зависших прогонов не выполнилась', Logger.statuses.FAIL, {
                    data: { message: error instanceof Error ? error.message : String(error) },
                });
            });
        }, minutes * 60_000);
        this.timer.unref?.();
    }

    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

function readCheckMinutes(): number {
    const raw = process.env.RESEARCH_STALE_CHECK_MIN;

    if (raw === undefined || raw.trim() === '') {
        return 5;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
        return 5;
    }

    return Math.floor(value);
}
