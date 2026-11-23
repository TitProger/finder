import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../../app.module';
import { MigrationService } from '../../../common/config/mikro-orm/migration.service';
import { DatabaseSeeder } from './database.seeder';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn'],
    });

    const seeder = app.get(DatabaseSeeder);

    try {
        await app.get(MigrationService).migrate();
        await seeder.run();
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
