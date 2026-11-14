import { LogLevel, writeWithLevel } from './log-writer';
import { statuses as loggerStatuses, LogMeta, LogStatus } from './logger.context';
import { enrichMetaWithSource } from './source-meta.helper';

export class Logger {
    public static readonly statuses = loggerStatuses;

    /** null — смотреть env LOGGER_SILENT; иначе принудительно. */
    private static forcedSilent: boolean | null = null;

    public static setSilent(value: boolean): void {
        this.forcedSilent = value;
    }

    public static isSilent(): boolean {
        if (this.forcedSilent !== null) {
            return this.forcedSilent;
        }

        return process.env.LOGGER_SILENT === 'true';
    }

    /** Выполнить fn без логов (например сидеры в int-тестах). */
    public static async runSilent<T>(fn: () => Promise<T>): Promise<T> {
        const prev = this.forcedSilent;

        this.forcedSilent = true;

        try {
            return await fn();
        } finally {
            this.forcedSilent = prev;
        }
    }

    public static info(message: unknown, status?: LogStatus, meta?: LogMeta): void {
        this.call('info', message, status, meta);
    }

    public static warn(message: unknown, status?: LogStatus, meta?: LogMeta): void {
        this.call('warn', message, status, meta);
    }

    public static error(message: unknown, status?: LogStatus, meta?: LogMeta): void {
        this.call('error', message, status, meta);
    }

    public static debug(message: unknown, status?: LogStatus, meta?: LogMeta): void {
        this.call('debug', message, status, meta);
    }

    private static call(level: LogLevel, message: unknown, status?: LogStatus, meta?: LogMeta): void {
        if (this.isSilent()) {
            return;
        }

        const enrichedMeta = enrichMetaWithSource(meta);

        writeWithLevel(level, message, status, enrichedMeta);
    }
}
