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
        /** true только в локальном .env и на dev. В проде false. */
        seedersRun: BooleanUtils.strToBoolWithDefault(process.env.PG_SEEDERS_RUN, false),
    },

    swagger: {
        enabled: BooleanUtils.strToBoolWithDefault(process.env.SWAGGER_ENABLED, true),
        path: process.env.SWAGGER_PATH || 'docs',
        /** Относительно process.cwd(): результат `npm run contract:sync` */
        openapiFile: process.env.OPENAPI_FILE || 'api/openapi.json',
    },

    admin: {
        /** Статический токен для HTTP API админки (Bearer) */
        apiToken: requireInProduction('ADMIN_API_TOKEN', process.env.ADMIN_API_TOKEN),
    },

    research: {
        /** Секрет POST /research/ingest. Пустой в dev — ручка отвечает 401. */
        ingestToken: requireInProduction('RESEARCH_INGEST_TOKEN', process.env.RESEARCH_INGEST_TOKEN, ''),
    },

    llm: {
        apiBaseUrl: process.env.LLM_API_BASE_URL || 'https://api.openai.com/v1/chat/completions',
        apiKey: (process.env.LLM_API_KEY || '').trim(),
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        confidenceThreshold: NumbersUtils.toNumberOrDefault(process.env.LLM_CONFIDENCE_THRESHOLD, 0.7),
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
