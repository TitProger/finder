import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { AppUserEntity } from '../../../../../domain/entities/user/app-user.entity';
import { AppUserRepository as AppUserRepositoryPort } from '../../../../../domain/repositories/user/app-user.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class AppUserRepositoryImpl extends BaseRepositoryImpl<AppUserEntity> implements AppUserRepositoryPort {
    constructor(
        @InjectRepository(AppUserEntity)
        repository: BaseRepositoryImpl<AppUserEntity>,
    ) {
        super(repository.getEntityManager(), AppUserEntity);
    }
}
