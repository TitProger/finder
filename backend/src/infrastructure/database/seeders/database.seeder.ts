import { Injectable, Logger } from '@nestjs/common';

import { resolveCategoriesYaml } from './categories-yaml-path';
import { CategorySeederService } from './category-seeder.service';
import { DemoProductsSeeder } from './demo/demo-products.seeder';

/**
 * Шаги по порядку: справочник категорий, затем демо-товары истории.
 * Админы по-прежнему сажает AdminSeeder при старте, отдельно от этого оркестратора.
 */
@Injectable()
export class DatabaseSeeder {
    private readonly logger = new Logger(DatabaseSeeder.name);

    constructor(
        private readonly categories: CategorySeederService,
        private readonly products: DemoProductsSeeder,
    ) {}

    async run(): Promise<void> {
        this.logger.log('Запуск заполнения базы');
        await this.categories.seedFromYaml(resolveCategoriesYaml());
        await this.products.seed();
        this.logger.log('Заполнение базы завершено');
    }
}
