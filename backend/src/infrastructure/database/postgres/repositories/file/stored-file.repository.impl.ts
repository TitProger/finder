import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { StoredFileEntity } from '../../../../../domain/entities/file/stored-file.entity';
import { StoredFileRepository as StoredFileRepositoryPort } from '../../../../../domain/repositories/file/stored-file.repository';
import { BaseRepositoryImpl } from '../common/base.repository.impl';

@Injectable()
export class StoredFileRepositoryImpl extends BaseRepositoryImpl<StoredFileEntity> implements StoredFileRepositoryPort {
    constructor(
        @InjectRepository(StoredFileEntity)
        repository: BaseRepositoryImpl<StoredFileEntity>,
    ) {
        super(repository.getEntityManager(), StoredFileEntity);
    }
}
