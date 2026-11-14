import { Module } from '@nestjs/common';

import { getDatabaseModules } from './common/config/database.modules';
import { Envs } from './common/envs/env';
import { MigrationService } from './common/config/mikro-orm/migration.service';

import { DomainModule } from './domain/domain.module';
import { InfrastructureModule } from './infrastructure/config/modules/infrastructure.module';
import { ApplicationModule } from './application/application.module';
import { InterfacesModule } from './interfaces/interfaces.module';

/**
 * Корневой модуль: Domain ← Infrastructure, Application → Domain, Interfaces → Application.
 */
@Module({
    imports: [...getDatabaseModules(), DomainModule, InfrastructureModule, ApplicationModule, InterfacesModule],
    providers: [...(Envs.postgres.enabled && Envs.postgres.host ? [MigrationService] : [])],
})
export class AppModule {}
