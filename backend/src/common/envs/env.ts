import * as process from 'process';
import { config } from 'dotenv';
import { NumbersUtils } from '../utils/numbers.utils';
import { BooleanUtils } from './boolean.utils';

config();

const isProduction = process.env.NODE_ENV === 'production';

export const Envs = {
    main: {
        host: process.env.APP_HOST || '0.0.0.0',
        appPort: NumbersUtils.toNumberOrDefault(process.env.APP_PORT, 8080),
    },

    postgres: {
        enabled: BooleanUtils.strToBoolWithDefault(process.env.PG_ENABLED, true),
        host: process.env.PG_HOST || 'localhost',
        port: NumbersUtils.toNumberOrDefault(process.env.PG_PORT, 5432),
        name: process.env.PG_DATABASE || 'finder',
        username: process.env.PG_USERNAME || 'finder',
        password: process.env.PG_PASSWORD || 'finder',
        migrationsRun: BooleanUtils.strToBoolWithDefault(process.env.PG_MIGRATIONS_RUN, true),
        logging: BooleanUtils.strToBoolWithDefault(process.env.PG_LOGGING, true),
    },

    swagger: {
        enabled: BooleanUtils.strToBoolWithDefault(process.env.SWAGGER_ENABLED, true),
        path: process.env.SWAGGER_PATH || 'docs',
        /** Относительно process.cwd(): результат `npm run contract:sync` */
        openapiFile: process.env.OPENAPI_FILE || 'api/openapi.json',
    },

    jwt: {
        secret: requireInProduction('JWT_SECRET', process.env.JWT_SECRET, 'finder-dev-jwt-secret-change-me'),
        accessTtlSec: NumbersUtils.toNumberOrDefault(process.env.JWT_ACCESS_TTL_SEC, 3600),
        refreshTtlSec: NumbersUtils.toNumberOrDefault(process.env.JWT_REFRESH_TTL_SEC, 60 * 60 * 24 * 14),
    },

    admin: {
        /** Статический токен для HTTP API админки (Bearer) */
        apiToken: requireInProduction('ADMIN_API_TOKEN', process.env.ADMIN_API_TOKEN),
        /** Список Telegram ID админов через запятую */
        telegramIds: parseTelegramIds(process.env.ADMIN_TELEGRAM_IDS),
    },

    adminSeed: {
        login: process.env.ADMIN_SEED_LOGIN || 'admin',
        password: requireInProduction('ADMIN_SEED_PASSWORD', process.env.ADMIN_SEED_PASSWORD, 'admin'),
        displayName: process.env.ADMIN_SEED_DISPLAY_NAME || 'Finder Admin',
        telegramUserId: readTelegramUserId(process.env.ADMIN_SEED_TELEGRAM_USER_ID),
    },

    telegram: {
        botToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    },

    tariffs: {
        freePlanDailyLimit: NumbersUtils.toNumberOrDefault(process.env.FREE_PLAN_DAILY_LIMIT, 3),
    },
};

function requireInProduction(name: string, value: string | undefined, devDefault?: string): string {
    if (isProduction) {
        if (!value || (devDefault && value === devDefault)) {
            throw new Error(
                `${name} обязателен в production и не может иметь значение по умолчанию. ` +
                    `Установите ${name} в environment variables.`,
            );
        }

        return value;
    }

    return value || devDefault || '';
}

function readTelegramUserId(raw: string | undefined): string | null {
    const value = (raw ?? '').trim();

    if (!value) {
        return null;
    }

    if (!/^[1-9]\d{0,18}$/.test(value)) {
        throw new Error('ADMIN_SEED_TELEGRAM_USER_ID должен быть положительным целым Telegram user id');
    }

    return value;
}

function parseTelegramIds(raw: string | undefined): string[] {
    const value = (raw ?? '').trim();

    if (!value) {
        return [];
    }

    const ids = value.split(',').map((id) => id.trim()).filter(Boolean);

    for (const id of ids) {
        if (!/^[1-9]\d{0,18}$/.test(id)) {
            throw new Error(`ADMIN_TELEGRAM_IDS содержит невалидный Telegram ID: ${id}`);
        }
    }

    return ids;
}
