import { DynamicModule } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Envs } from '../../envs/env';
import config from './mikro-orm.config';

export const getMikroOrmModule = (): DynamicModule | Promise<DynamicModule> | null => {
    return Envs.postgres.enabled && Envs.postgres.host ? MikroOrmModule.forRoot(config) : null;
};
