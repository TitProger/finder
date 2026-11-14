import { join } from 'node:path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

// Транспорты, сгруппированные и настраиваемые по уровням
export const levelTransports = (logsDir: string) => {
    return {
        console: new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
        error: new DailyRotateFile({
            level: 'error',
            filename: join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        }),
        info: new DailyRotateFile({
            level: 'debug',
            filename: join(logsDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        }),
    };
};
