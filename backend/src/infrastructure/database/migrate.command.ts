import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { MigrationService } from '../../common/config/mikro-orm/migration.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['log', 'error', 'warn'],
    });

    try {
        await app.get(MigrationService).migrate();
        // eslint-disable-next-line no-console
        console.log('✓ Migrations completed');
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('✗ Migrations failed:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

bootstrap();
