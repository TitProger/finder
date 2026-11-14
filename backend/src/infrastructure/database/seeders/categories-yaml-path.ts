import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ts-node запускается из src, собранный seed — из dist. Оба находят backend/seeds.
 */
export function resolveCategoriesYaml(): string {
    const candidates = [
        resolve(process.cwd(), 'seeds/categories.yaml'),
        resolve(__dirname, '../../../../seeds/categories.yaml'),
        resolve(__dirname, '../../../../../seeds/categories.yaml'),
    ];
    const found = candidates.find((path) => existsSync(path));

    if (!found) {
        throw new Error('Не найден seeds/categories.yaml');
    }

    return found;
}
