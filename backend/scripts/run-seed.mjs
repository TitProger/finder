import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const compiled = 'dist/src/infrastructure/database/seeders/seed.command.js';
const tsNode = 'node_modules/ts-node/dist/bin.js';

let args;

if (existsSync(tsNode)) {
    args = [tsNode, '-r', 'tsconfig-paths/register', 'src/infrastructure/database/seeders/seed.command.ts'];
} else if (existsSync(compiled)) {
    args = [compiled];
} else {
    console.error('Нет ts-node и нет собранного seed.command.js');
    process.exit(1);
}

const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });

process.exit(result.status === null ? 1 : result.status);
