import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../../app.module';
import { resolveCategoriesYaml } from './categories-yaml-path';
import { CategorySeederService } from './category-seeder.service';

async function bootstrap() {
    process.env.TELEGRAM_POLLING = 'false';

    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn'],
    });

    const seeder = app.get(CategorySeederService);
    const yamlPath = resolveCategoriesYaml();

    try {
        await seeder.seedFromYaml(yamlPath);
        // eslint-disable-next-line no-console
        console.log('✓ Seeding completed successfully');
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('✗ Seeding failed:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

bootstrap();
