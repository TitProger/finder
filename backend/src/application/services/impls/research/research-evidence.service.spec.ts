import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { ResearchEvidenceServiceImpl } from './research-evidence.service.impl';

type Stored = { id: string };

function stamp<T extends object>(entity: T, data: object): T {
    Object.assign(entity, data);
    const dated = entity as T & { createdAt?: Date; updatedAt?: Date | null };

    if (!dated.createdAt) {
        dated.createdAt = new Date();
    }

    if (dated.updatedAt === undefined) {
        dated.updatedAt = null;
    }

    return dated as T;
}

describe('ResearchEvidenceService (фикстуры)', () => {
    it('отдаёт URL, цитату, время и статус площадки', async () => {
        const runId = randomUUID();
        const inquiry = stamp(new InquiryEntity(), {
            status: InquiryStatus.DOSSIER_WITH_ADMIN,
            rawText: 'халаты',
            photoUrls: [],
            isPaused: false,
        });
        const run = stamp(new ResearchRunEntity(), {
            inquiry,
            source: 'research_ingest',
            status: ResearchRunStatus.SUCCEEDED,
            runId,
            dossierStatus: 'partial',
            sites: [
                { site: '1688', status: 'ok', url: 'https://s.1688.com/x' },
                { site: 'wildberries', status: 'captcha', note: 'капча' },
            ],
        });
        const offer = stamp(new OfferEntity(), {
            researchRun: run,
            sourceUrl: 'https://detail.1688.com/offer/1.html',
            quoteText: 'хлопок, от 500 штук',
            site: '1688',
            capturedAt: new Date('2026-11-14T08:05:00.000Z'),
        });
        const runs = [run];
        const offers = [offer];
        const service = new ResearchEvidenceServiceImpl(
            {
                findOne: async (where: { runId?: string }) =>
                    runs.find((row) => row.runId === where.runId) ?? null,
            } as unknown as ResearchRunRepository,
            {
                find: async () => offers,
            } as unknown as OfferRepository,
        );

        const evidence = await service.getByRunId(runId);

        expect(evidence).toEqual({
            runId,
            inquiryId: inquiry.id,
            items: [
                {
                    url: 'https://detail.1688.com/offer/1.html',
                    quote: 'хлопок, от 500 штук',
                    capturedAt: new Date('2026-11-14T08:05:00.000Z'),
                    site: '1688',
                    siteStatus: 'ok',
                },
            ],
        });
    });
});
