import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../../app.module';
import { CategorySeederService } from './category-seeder.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn'],
    });

    const seeder = app.get(CategorySeederService);
    const yamlPath = resolve(__dirname, '../../../../seeds/categories.yaml');

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
