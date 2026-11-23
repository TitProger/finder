import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import {
    ResearchEvidenceItemView,
    ResearchEvidenceService,
    ResearchEvidenceView,
} from '../../contracts/research/research-evidence.service';

type SiteRow = {
    site?: unknown;
    status?: unknown;
    url?: unknown;
};

/**
 * Сырые свидетельства для админа: URL, цитата, время, статус площадки.
 */
@Injectable()
export class ResearchEvidenceServiceImpl implements ResearchEvidenceService {
    constructor(
        @Inject(REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY)
        private readonly runs: ResearchRunRepository,
        @Inject(REPOSITORY_TOKENS.OFFER_REPOSITORY)
        private readonly offers: OfferRepository,
    ) {}

    async getByRunId(runId: string): Promise<ResearchEvidenceView> {
        const run = await this.runs.findOne({ runId }, { populate: ['inquiry'] });

        if (!run || !run.runId) {
            throw new NotFoundAppException(AppErrors.research.runNotFound.message, {
                code: AppErrors.research.runNotFound.code,
            });
        }

        const siteStatusByName = siteStatusMap(run.sites);
        const offers = await this.offers.find({ researchRun: run.id }, { orderBy: { capturedAt: 'ASC' } });
        const items: ResearchEvidenceItemView[] = offers.map((offer) => ({
            url: offer.sourceUrl,
            quote: offer.quoteText ?? null,
            capturedAt: offer.capturedAt,
            site: offer.site ?? null,
            siteStatus: resolveSiteStatus(offer.site ?? null, offer.sourceUrl, siteStatusByName, run.sites),
        }));

        if (items.length === 0) {
            for (const row of asSiteRows(run.sites)) {
                const url = typeof row.url === 'string' ? row.url : null;

                if (!url) {
                    continue;
                }

                items.push({
                    url,
                    quote: null,
                    capturedAt: run.finishedAt ?? run.startedAt ?? run.createdAt,
                    site: typeof row.site === 'string' ? row.site : null,
                    siteStatus: typeof row.status === 'string' ? row.status : 'unknown',
                });
            }
        }

        return {
            runId: run.runId,
            inquiryId: run.inquiry.id,
            items,
        };
    }
}

function asSiteRows(value: unknown): SiteRow[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((row): row is SiteRow => row !== null && typeof row === 'object');
}

function siteStatusMap(value: unknown): Map<string, string> {
    const map = new Map<string, string>();

    for (const row of asSiteRows(value)) {
        if (typeof row.site === 'string' && typeof row.status === 'string') {
            map.set(row.site.toLowerCase(), row.status);
        }
    }

    return map;
}

function resolveSiteStatus(
    site: string | null,
    url: string,
    byName: Map<string, string>,
    sites: unknown,
): string {
    if (site) {
        const byExact = byName.get(site.toLowerCase());

        if (byExact) {
            return byExact;
        }
    }

    for (const row of asSiteRows(sites)) {
        if (typeof row.url === 'string' && row.url === url && typeof row.status === 'string') {
            return row.status;
        }
    }

    return 'unknown';
}
