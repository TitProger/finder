import { NestFactory } from '@nestjs/core';
import { resolve } from 'path';

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
        console.log('✓ Seeding completed successfully');
    } catch (error) {
        console.error('✗ Seeding failed:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

bootstrap();
