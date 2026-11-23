/**
 * Локальное хранилище файлов. Реализация — в infrastructure.
 */
export interface FileStoragePort {
    put(storageKey: string, sourcePath: string): Promise<void>;
    putBytes(storageKey: string, body: Buffer): Promise<void>;
    /** Абсолютный путь, если файл лежит внутри корня хранилища. Иначе null. */
    resolveExisting(storageKey: string): string | null;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
