import { basename, extname } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '@/application/errors';
import { FILE_STORAGE, FileStoragePort } from '@/application/ports/file-storage.port';
import { BadRequestAppException } from '@/common/exceptions/bad-request.exception';
import { NotFoundAppException } from '@/common/exceptions/not-found.exception';
import { StoredFileEntity } from '@/domain/entities/file/stored-file.entity';
import { REPOSITORY_TOKENS } from '@/domain/repositories/repository.tokens';
import { StoredFileRepository } from '@/domain/repositories/file/stored-file.repository';

const MAX_BYTES = 8 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
};

const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

export type OpenedStoredFile = {
    absolutePath: string;
    mime: string;
    filename: string;
};

export type UploadStoredFileInput = {
    body: Buffer;
    filename?: string | null;
    mime?: string | null;
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

    async upload(input: UploadStoredFileInput): Promise<StoredFileEntity> {
        if (!input.body?.length) {
            throw new BadRequestAppException(AppErrors.file.fileRequired.message, {
                code: AppErrors.file.fileRequired.code,
            });
        }

        if (input.body.length > MAX_BYTES) {
            throw new BadRequestAppException(AppErrors.file.tooLarge.message, {
                code: AppErrors.file.tooLarge.code,
            });
        }

        const ext = resolveExtension(input.filename, input.mime);

        if (!ext) {
            throw new BadRequestAppException(AppErrors.file.unsupportedType.message, {
                code: AppErrors.file.unsupportedType.code,
            });
        }

        const mime = MIME_BY_EXT[ext];
        const file = this.files.create({
            storageKey: `inquiries/pending${ext}`,
            mime,
            sizeBytes: input.body.length,
        });
        const storageKey = `inquiries/${file.id}${ext}`;

        file.storageKey = storageKey;
        await this.storage.putBytes(storageKey, input.body);

        const em = this.files.getEntityManager();

        em.persist(file);
        await em.flush();

        return file;
    }

    async requireIds(ids: readonly string[]): Promise<string[]> {
        const unique = [...new Set(ids)];

        if (unique.length !== ids.length) {
            throw new BadRequestAppException(AppErrors.file.mediaDuplicate.message, {
                code: AppErrors.file.mediaDuplicate.code,
            });
        }

        if (unique.length === 0) {
            return [];
        }

        const found = await this.files.find({ id: { $in: unique } });

        if (found.length !== unique.length) {
            throw new BadRequestAppException(AppErrors.file.mediaNotFound.message, {
                code: AppErrors.file.mediaNotFound.code,
            });
        }

        return unique;
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

function resolveExtension(filename?: string | null, mime?: string | null): string | null {
    const fromName = filename ? extname(filename).toLowerCase() : '';

    if (fromName && MIME_BY_EXT[fromName]) {
        return fromName === '.jpeg' ? '.jpg' : fromName;
    }

    if (mime && EXT_BY_MIME[mime]) {
        return EXT_BY_MIME[mime];
    }

    return null;
}
