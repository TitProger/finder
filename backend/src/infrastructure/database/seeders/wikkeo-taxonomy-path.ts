import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Снимок дерева Wikkeo лежит в Finder-materials рядом с backend/.
 */
export function resolveWikkeoCategoriesJson(): string {
    const candidates = [
        resolve(process.cwd(), '../Finder-materials/wikkeo-categories.json'),
        resolve(process.cwd(), 'Finder-materials/wikkeo-categories.json'),
        resolve(__dirname, '../../../../../Finder-materials/wikkeo-categories.json'),
        resolve(__dirname, '../../../../../../Finder-materials/wikkeo-categories.json'),
    ];
    const found = candidates.find((path) => existsSync(path));

    if (!found) {
        throw new Error('Не найден Finder-materials/wikkeo-categories.json');
    }

    return found;
}
