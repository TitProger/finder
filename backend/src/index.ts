import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { version } from '../package.json';
import { AppModule } from './app.module';
import { configureApp } from './common/config/app/app.config';
import { Envs } from './common/envs/env';
import { Logger } from './common/logger/logger';

export class App {
    private readonly ADDRESS: string;
    private readonly PORT: number;

    constructor(PORT: number, ADDRESS: string) {
        this.PORT = PORT;
        this.ADDRESS = ADDRESS;
    }

    /** HTTP-приложение (prod / start:dev). */
    public static createNestApp(): Promise<NestFastifyApplication> {
        return NestFactory.create<NestFastifyApplication>(
            AppModule,
            new FastifyAdapter({
                genReqId: () => randomUUID(),
                bodyLimit: 5 * 1024 * 1024,
            }),
            {
                bufferLogs: true,
            },
        );
    }

    public async run() {
        const app = await App.createNestApp();

        await configureApp(app);
        await app.listen(this.PORT, this.ADDRESS);

        this.logInformationAfterStartServer(await app.getUrl());
    }

    private logInformationAfterStartServer(url: string) {
        Logger.info(`Сервер запущен на порту ${this.PORT}`, Logger.statuses.SUCCESS, {
            data: {
                version: version,
                url: url,
            },
        });

        if (Envs.swagger.enabled) {
            Logger.info(`Swagger UI (статика OpenAPI)`, Logger.statuses.SUCCESS, {
                data: {
                    version: version,
                    url: `${url}/${Envs.swagger.path}`,
                    openapi: Envs.swagger.openapiFile,
                },
            });
        }
    }
}
