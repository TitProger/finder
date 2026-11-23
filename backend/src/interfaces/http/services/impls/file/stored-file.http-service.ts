import { createReadStream } from 'node:fs';
import { Injectable, StreamableFile } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';

import { AppErrors } from '@/application/errors';
import { AppMessages } from '@/application/messages';
import { StoredFileService } from '@/application/services/impls/file/stored-file.service';
import { BadRequestAppException } from '@/common/exceptions/bad-request.exception';
import { ServiceResult } from '../../../common/service-result.interface';
import type { StoredFile } from '../../../generated/responses/files';
import { StoredFileMapper } from '../../../mappers/file/stored-file.mapper';

@Injectable()
export class StoredFileHttpService {
    constructor(private readonly files: StoredFileService) {}

    async content(id: string): Promise<StreamableFile> {
        const opened = await this.files.open(id);

        return new StreamableFile(createReadStream(opened.absolutePath), {
            type: opened.mime,
            disposition: `inline; filename="${opened.filename}"`,
        });
    }

    async upload(request: FastifyRequest): Promise<ServiceResult<StoredFile>> {
        const parsed = await this.parseUpload(request);
        const file = await this.files.upload(parsed);

        return {
            data: StoredFileMapper.toDto(file),
            message: AppMessages.common.created,
        };
    }

    private async parseUpload(request: FastifyRequest): Promise<{
        body: Buffer;
        filename: string | null;
        mime: string | null;
    }> {
        let filePart: MultipartFile | undefined;
        let body: Buffer | undefined;

        for await (const part of request.parts()) {
            if (part.type === 'file' && part.fieldname === 'file' && !filePart) {
                filePart = part;
                body = await part.toBuffer();
            }
        }

        if (!filePart || !body) {
            throw new BadRequestAppException(AppErrors.file.fileRequired.message, {
                code: AppErrors.file.fileRequired.code,
            });
        }

        return {
            body,
            filename: filePart.filename || null,
            mime: filePart.mimetype || null,
        };
    }
}
