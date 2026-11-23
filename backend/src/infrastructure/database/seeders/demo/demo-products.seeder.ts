import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { EntityManager } from '@mikro-orm/core';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { FILE_STORAGE, FileStoragePort } from '../../../../application/ports/file-storage.port';
import { SearchedProductDossier } from '../../../../domain/entities/catalog/searched-product.dossier';
import { SearchedProductEntity } from '../../../../domain/entities/catalog/searched-product.entity';
import { StoredFileEntity } from '../../../../domain/entities/file/stored-file.entity';
import { DEMO_PRODUCTS, DemoProductSeed } from './demo-products.data';

const MIME_BY_EXT: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
};

function resolveSeedMediaRoot(): string {
    const candidates = [resolve(process.cwd(), 'seed-media')];
    const found = candidates.find((path) => existsSync(path));

    if (!found) {
        throw new Error('Не найдена папка seed-media рядом с backend');
    }

    return found;
}

/**
 * Второй шаг сида: четыре демо-товара. Повтор того же slug или пути файла ничего не копирует.
 */
@Injectable()
export class DemoProductsSeeder {
    private readonly logger = new Logger(DemoProductsSeeder.name);
    private readonly files = new Map<string, StoredFileEntity>();

    constructor(
        private readonly em: EntityManager,
        @Inject(FILE_STORAGE)
        private readonly storage: FileStoragePort,
    ) {}

    async seed(): Promise<void> {
        const mediaRoot = resolveSeedMediaRoot();

        for (const item of DEMO_PRODUCTS) {
            await this.seedOne(mediaRoot, item);
        }
    }

    private async seedOne(mediaRoot: string, item: DemoProductSeed): Promise<void> {
        const existing = await this.em.findOne(
            SearchedProductEntity,
            { slug: item.slug },
            { filters: { softDelete: false } },
        );

        if (existing) {
            await this.refreshMedia(mediaRoot, item);
            this.logger.log(`Демо-товар ${item.slug} уже есть, файлы обновлены`);

            return;
        }

        const cover = await this.ensureFile(mediaRoot, item.cover);
        const photos: SearchedProductDossier['photos'] = [];

        for (const shot of item.gallery) {
            const file = await this.ensureFile(mediaRoot, shot.path);

            photos.push({ fileId: file.id, alt: shot.alt });
        }

        const dossier: SearchedProductDossier = { ...item.dossier, photos };
        const product = this.em.create(SearchedProductEntity, {
            slug: item.slug,
            name: item.name,
            categoryLabel: item.categoryLabel,
            chipLabel: item.chipLabel,
            materialCount: item.materialCount,
            searchedAt: new Date(item.searchedAt),
            article: item.article,
            coverFile: cover,
            dossier,
        });

        this.em.persist(product);
        await this.em.flush();
        await this.em.nativeUpdate(
            SearchedProductEntity,
            { id: product.id },
            {
                createdAt: new Date(item.createdAt),
                updatedAt: new Date(item.updatedAt),
            },
        );
        this.logger.log(`Демо-товар ${item.slug} записан`);
    }

    private async refreshMedia(mediaRoot: string, item: DemoProductSeed): Promise<void> {
        await this.rewriteFile(mediaRoot, item.cover);

        for (const shot of item.gallery) {
            await this.rewriteFile(mediaRoot, shot.path);
        }
    }

    private async rewriteFile(mediaRoot: string, storageKey: string): Promise<void> {
        const sourcePath = resolve(mediaRoot, storageKey);

        if (!existsSync(sourcePath)) {
            throw new Error(`Файл сида не найден: ${sourcePath}`);
        }

        const existing = await this.em.findOne(
            StoredFileEntity,
            { storageKey },
            { filters: { softDelete: false } },
        );

        await this.storage.put(storageKey, sourcePath);

        if (!existing) {
            return;
        }

        const fileStat = await stat(sourcePath);

        existing.sizeBytes = fileStat.size;
        existing.mime = MIME_BY_EXT[extname(storageKey).toLowerCase()] ?? existing.mime;
        this.em.persist(existing);
        await this.em.flush();
    }

    private async ensureFile(mediaRoot: string, storageKey: string): Promise<StoredFileEntity> {
        const cached = this.files.get(storageKey);

        if (cached) {
            return cached;
        }

        const existing = await this.em.findOne(
            StoredFileEntity,
            { storageKey },
            { filters: { softDelete: false } },
        );

        if (existing) {
            this.files.set(storageKey, existing);

            return existing;
        }

        const sourcePath = resolve(mediaRoot, storageKey);

        if (!existsSync(sourcePath)) {
            throw new Error(`Файл сида не найден: ${sourcePath}`);
        }

        await this.storage.put(storageKey, sourcePath);
        const fileStat = await stat(sourcePath);
        const mime = MIME_BY_EXT[extname(storageKey).toLowerCase()] ?? 'application/octet-stream';
        const file = this.em.create(StoredFileEntity, {
            storageKey,
            mime,
            sizeBytes: fileStat.size,
        });

        this.em.persist(file);
        await this.em.flush();
        this.files.set(storageKey, file);
        this.logger.log(`Файл сида ${storageKey}`);

        return file;
    }
}
