import { createReadStream } from 'node:fs';
import { Injectable, StreamableFile } from '@nestjs/common';

import { StoredFileService } from '@/application/services/impls/file/stored-file.service';

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
}
