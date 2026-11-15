import winston from 'winston';

import { baseFormat, resolveLogsDir, selectLogTransports } from './logger.config';
import { buildLogStructure, LogMeta, LogStatus } from './logger.context';

export type LogLevel = 'info' | 'error' | 'warn' | 'debug';

const logsDir = resolveLogsDir();
const transports = selectLogTransports(logsDir);

if (transports.length === 1 && process.env.LOGGER_SILENT !== 'true') {
    process.stderr.write(`Каталог логов недоступен (${logsDir}), пишу только в консоль\n`);
}

const winstonLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: baseFormat,
    transports,
});

winstonLogger.on('error', () => {
    // Ошибка файла не должна останавливать процесс.
});

export function writeWithLevel(level: LogLevel, message: unknown, status?: LogStatus, meta?: LogMeta): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    const logStructure = buildLogStructure(level, messageStr, status, meta);

    winstonLogger[level](logStructure);
}
