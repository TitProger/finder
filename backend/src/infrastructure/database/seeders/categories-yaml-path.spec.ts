import { resolve } from 'node:path';

import { resolveCategoriesYaml } from './categories-yaml-path';

describe('resolveCategoriesYaml', () => {
    it('находит справочник категорий от корня backend', () => {
        expect(resolveCategoriesYaml()).toBe(resolve(process.cwd(), 'seeds/categories.yaml'));
    });
});
