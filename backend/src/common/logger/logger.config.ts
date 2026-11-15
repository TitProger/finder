import { accessSync, constants, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/** Маленькая ротация: на диске VPS около 2 ГБ свободно. */
export const LOG_MAX_SIZE = '5m';
export const LOG_MAX_FILES = '3';

export const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

export function resolveLogsDir(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string {
    const custom = (env.LOG_DIR ?? '').trim();

    return custom || join(cwd, 'logs');
}

/**
 * true, если в каталог можно создать файл. Иначе файловые транспорты не подключаем:
 * winston-daily-rotate-file сам делает mkdir и роняет процесс с EACCES.
 */
export function canWriteLogDir(logsDir: string): boolean {
    const probe = join(logsDir, '.writable');

    try {
        mkdirSync(logsDir, { recursive: true });
        writeFileSync(probe, '');
        unlinkSync(probe);
        accessSync(logsDir, constants.W_OK);

        return true;
    } catch {
        return false;
    }
}

export function createConsoleTransport(): winston.transport {
    return new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    });
}

export function createFileTransports(logsDir: string): winston.transport[] {
    return [
        new DailyRotateFile({
            level: 'error',
            filename: join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: LOG_MAX_SIZE,
            maxFiles: LOG_MAX_FILES,
        }),
        new DailyRotateFile({
            level: 'debug',
            filename: join(logsDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: LOG_MAX_SIZE,
            maxFiles: LOG_MAX_FILES,
        }),
    ];
}

/** Консоль всегда. Файлы — только если каталог доступен на запись. */
export function selectLogTransports(logsDir: string): winston.transport[] {
    const consoleTransport = createConsoleTransport();

    if (!canWriteLogDir(logsDir)) {
        return [consoleTransport];
    }

    return [consoleTransport, ...createFileTransports(logsDir)];
}
