import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import winston from 'winston';

import { canWriteLogDir, resolveLogsDir, selectLogTransports } from './logger.config';

describe('log directory', () => {
    const created: string[] = [];

    afterEach(() => {
        for (const dir of created.splice(0)) {
            chmodSync(dir, 0o755);
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('берёт каталог из LOG_DIR', () => {
        expect(resolveLogsDir({ LOG_DIR: ' /var/log/finder ' }, '/app')).toBe('/var/log/finder');
    });

    it('без LOG_DIR пишет в logs внутри cwd', () => {
        expect(resolveLogsDir({}, '/app')).toBe(join('/app', 'logs'));
    });

    it('если каталог нельзя создать, остаётся только консоль', () => {
        const parent = mkdtempSync(join(tmpdir(), 'finder-logs-'));

        created.push(parent);
        chmodSync(parent, 0o555);

        const blocked = join(parent, 'logs');

        expect(canWriteLogDir(blocked)).toBe(false);

        const transports = selectLogTransports(blocked);

        expect(transports).toHaveLength(1);
        expect(transports[0]).toBeInstanceOf(winston.transports.Console);
        transports.forEach((transport) => transport.close?.());
    });

    it('в доступный каталог добавляет файловые транспорты', () => {
        const dir = mkdtempSync(join(tmpdir(), 'finder-logs-ok-'));

        created.push(dir);

        expect(canWriteLogDir(dir)).toBe(true);
    });
});
