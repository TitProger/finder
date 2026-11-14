import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

if (!(globalThis as { crypto?: { randomUUID: typeof randomUUID } }).crypto) {
    (globalThis as { crypto: { randomUUID: typeof randomUUID } }).crypto = { randomUUID };
}

if (!process.env.TZ) {
    process.env.TZ = 'Europe/Moscow';
}

import { Envs } from './common/envs/env';
import { App } from './index';

const app = new App(Envs.main.appPort, Envs.main.host);

app.run();
