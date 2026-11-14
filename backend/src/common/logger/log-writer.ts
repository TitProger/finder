import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import winston from 'winston';
import { baseFormat, levelTransports } from './logger.config';
import { buildLogStructure, LogMeta, LogStatus } from './logger.context';

export type LogLevel = 'info' | 'error' | 'warn' | 'debug';

// Путь к папке логов
const logsDir = join(process.cwd(), 'logs');

if (!existsSync(logsDir)) {
    try {
        mkdirSync(logsDir, { recursive: true });
    } catch (_e) {
        // noop
    }
}

// Создаем winston логгер
const winstonLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: baseFormat,
    transports: [levelTransports(logsDir).console, levelTransports(logsDir).error, levelTransports(logsDir).info],
});

export function writeWithLevel(level: LogLevel, message: unknown, status?: LogStatus, meta?: LogMeta): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const logStructure = buildLogStructure(level, messageStr, status, meta);

    winstonLogger[level](logStructure);
}
