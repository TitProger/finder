import { copyFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';

import { FileStoragePort } from '../../application/ports/file-storage.port';

@Injectable()
export class LocalFileStorage implements FileStoragePort {
    root(): string {
        return resolve(process.cwd(), process.env.STORAGE_PATH || 'storage');
    }

    async put(storageKey: string, sourcePath: string): Promise<void> {
        const target = this.resolveInside(storageKey);

        if (!target) {
            throw new Error(`Ключ файла выходит за хранилище: ${storageKey}`);
        }

        await mkdir(dirname(target), { recursive: true });
        await copyFile(sourcePath, target);
    }

    resolveExisting(storageKey: string): string | null {
        const target = this.resolveInside(storageKey);

        if (!target || !existsSync(target)) {
            return null;
        }

        return target;
    }

    async sizeOf(sourcePath: string): Promise<number> {
        const file = await stat(sourcePath);

        return file.size;
    }

    private resolveInside(storageKey: string): string | null {
        const root = this.root();
        const abs = resolve(root, storageKey);
        const rel = relative(root, abs);

        if (rel.startsWith('..') || isAbsolute(rel)) {
            return null;
        }

        return abs;
    }
}
