import { DynamicModule, Type } from '@nestjs/common';
import { Envs } from '../envs/env';
import { getMikroOrmModule } from './mikro-orm/mikro-orm.module';

export const getDatabaseModules = (): Array<DynamicModule | Type<unknown>> => {
    const modules: Array<DynamicModule | Type<unknown>> = [];

    if (Envs.postgres.enabled && Envs.postgres.host) {
        const mikroOrmModule = getMikroOrmModule();

        if (mikroOrmModule) {
            modules.push(mikroOrmModule as DynamicModule);
        }
    }

    return modules;
};
