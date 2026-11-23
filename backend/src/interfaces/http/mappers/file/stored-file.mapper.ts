import { StoredFileEntity } from '../../../../domain/entities/file/stored-file.entity';
import type { StoredFile } from '../../generated/responses/files';

export class StoredFileMapper {
    static toDto(file: StoredFileEntity): StoredFile {
        return {
            id: file.id,
            mime: file.mime,
            sizeBytes: file.sizeBytes,
        };
    }
}
