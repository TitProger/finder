import { basename } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '@/application/errors';
import { FILE_STORAGE, FileStoragePort } from '@/application/ports/file-storage.port';
import { NotFoundAppException } from '@/common/exceptions/not-found.exception';
import { StoredFileEntity } from '@/domain/entities/file/stored-file.entity';
import { REPOSITORY_TOKENS } from '@/domain/repositories/repository.tokens';
import { StoredFileRepository } from '@/domain/repositories/file/stored-file.repository';

export type OpenedStoredFile = {
    absolutePath: string;
    mime: string;
    filename: string;
};

@Injectable()
export class StoredFileService {
    constructor(
        @Inject(REPOSITORY_TOKENS.STORED_FILE_REPOSITORY)
        private readonly files: StoredFileRepository,
        @Inject(FILE_STORAGE)
        private readonly storage: FileStoragePort,
    ) {}

    async open(id: string): Promise<OpenedStoredFile> {
        const file = await this.files.findOne({ id });

        if (!file) {
            throw new NotFoundAppException(AppErrors.common.notFound.message, {
                code: AppErrors.common.notFound.code,
                details: { id },
            });
        }

        return this.openEntity(file);
    }

    private openEntity(file: StoredFileEntity): OpenedStoredFile {
        const absolutePath = this.storage.resolveExisting(file.storageKey);

        if (!absolutePath) {
            throw new NotFoundAppException(AppErrors.common.notFound.message, {
                code: AppErrors.common.notFound.code,
                details: { id: file.id, storageKey: file.storageKey },
            });
        }

        return {
            absolutePath,
            mime: file.mime,
            filename: basename(file.storageKey),
        };
    }
}
