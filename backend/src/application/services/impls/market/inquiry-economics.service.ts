import { Inject, Injectable } from '@nestjs/common';

import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { ManualEconomicsEntity } from '../../../../domain/entities/market/manual-economics.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { decimalString } from '../../../../domain/market/decimal-qty';
import {
    aggregateLayerPrices,
    EconomicsInput,
    FallbackRates,
    FxTable,
    LandedUnit,
    landedUnits,
    LayerQuote,
    PricedOffer,
    readFallbackRates,
    readFxTable,
} from '../../../../domain/market/layer-prices';
import { validateEconomicsInput } from '../../../../domain/market/parse-economics-line';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { ManualEconomicsRepository } from '../../../../domain/repositories/market/manual-economics.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { AppErrors } from '../../../errors';

export const INQUIRY_ECONOMICS = Symbol('INQUIRY_ECONOMICS');

export type InquiryEconomicsView = {
    inquiryId: string;
    quotes: LayerQuote[];
    fxFallback: boolean;
    economics: EconomicsInput | null;
    landed: LandedUnit[];
};

/**
 * Слои досье в рублях и ручная экономика менеджера.
 * Цена остаётся у менеджера: метод ничего не отправляет клиенту.
 */
@Injectable()
export class InquiryEconomicsService {
    constructor(
        @Inject(REPOSITORY_TOKENS.INQUIRY_REPOSITORY)
        private readonly inquiries: InquiryRepository,
        @Inject(REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY)
        private readonly runs: ResearchRunRepository,
        @Inject(REPOSITORY_TOKENS.OFFER_REPOSITORY)
        private readonly offers: OfferRepository,
        @Inject(REPOSITORY_TOKENS.MANUAL_ECONOMICS_REPOSITORY)
        private readonly economics: ManualEconomicsRepository,
    ) {}

    async view(inquiryId: string): Promise<InquiryEconomicsView> {
        const inquiry = await this.inquiries.findOne({ id: inquiryId });

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        const dossier = await this.latestDossier(inquiryId);
        const quotes = aggregateLayerPrices(
            await this.pricedOffers(inquiryId),
            this.fxOf(dossier),
            readFallbackRates(),
        );
        const stored = await this.economics.findOne({ inquiry: inquiryId });
        const input = stored ? readStored(stored) : null;

        return {
            inquiryId,
            quotes,
            fxFallback: quotes.some((quote) => quote.fxUsed === 'fallback'),
            economics: input,
            landed: input ? landedUnits(quotes, input) : [],
        };
    }

    async save(inquiryId: string, input: EconomicsInput): Promise<InquiryEconomicsView> {
        const problem = validateEconomicsInput(input);

        if (problem) {
            throw new BadRequestAppException(problem, { code: AppErrors.economics.badInput.code });
        }

        const inquiry = await this.inquiries.findOne({ id: inquiryId });

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        const fallback = readFallbackRates();
        const fx = this.fxOf(await this.latestDossier(inquiryId));
        const quotes = aggregateLayerPrices(await this.pricedOffers(inquiryId), fx, fallback);
        const landed = landedUnits(quotes, input);
        const row = (await this.economics.findOne({ inquiry: inquiryId })) ?? new ManualEconomicsEntity();
        const primary = landed[0];

        row.inquiry = inquiry;
        row.logisticsCost = decimalString(input.deliveryPerUnit);
        row.dutyPercent = decimalString(input.dutyPercent);
        row.otherCost = decimalString(input.otherCost);
        row.markupPercent = decimalString(input.markupPercent);
        row.dutyCost = primary ? decimalString(primary.dutyAmount) : null;
        row.markupAmount = primary ? decimalString(primary.markupAmount) : null;
        row.fxRate = decimalString(rateUsed(fx, fallback, primary?.fxUsed));
        row.currency = 'RUB';
        row.clientPrice = null;
        row.note = noteOf(fx, fallback, primary?.fxUsed);

        const em = this.economics.getEntityManager();

        em.persist(row);
        await em.flush();

        return {
            inquiryId,
            quotes,
            fxFallback: quotes.some((quote) => quote.fxUsed === 'fallback'),
            economics: input,
            landed,
        };
    }

    private async pricedOffers(inquiryId: string): Promise<PricedOffer[]> {
        const run = await this.latestDossier(inquiryId);

        if (!run) {
            return [];
        }

        const rows = await this.offers.find({ researchRun: run.id });

        return rows.flatMap((offer) => {
            const price = Number(offer.price);

            if (!Number.isFinite(price)) {
                return [];
            }

            return [toPriced(offer, price)];
        });
    }

    private async latestDossier(inquiryId: string): Promise<ResearchRunEntity | null> {
        const rows = await this.runs.find({ inquiry: inquiryId });
        const ready = rows.filter((run) => run.payloadSha256 && run.dossierStatus !== 'failed');

        ready.sort((left, right) => (right.finishedAt?.getTime() ?? 0) - (left.finishedAt?.getTime() ?? 0));

        return ready[0] ?? null;
    }

    private fxOf(run: ResearchRunEntity | null): FxTable {
        return readFxTable(run?.fx);
    }
}

function toPriced(offer: OfferEntity, price: number): PricedOffer {
    return {
        layer: offer.layer ?? null,
        unit: offer.unit ?? null,
        price,
        currency: offer.currency ?? null,
    };
}

function readStored(row: ManualEconomicsEntity): EconomicsInput | null {
    const deliveryPerUnit = Number(row.logisticsCost);
    const dutyPercent = Number(row.dutyPercent);
    const markupPercent = Number(row.markupPercent);
    const otherCost = Number(row.otherCost ?? 0);

    if (![deliveryPerUnit, dutyPercent, markupPercent, otherCost].every((value) => Number.isFinite(value))) {
        return null;
    }

    return { deliveryPerUnit, dutyPercent, otherCost, markupPercent };
}

function rateUsed(fx: FxTable, fallback: FallbackRates, source: LandedUnit['fxUsed'] | undefined): number {
    if (source === 'rub') {
        return 1;
    }

    if (fx.cnyRub) {
        return fx.cnyRub;
    }

    if (source === 'fallback' || !fx.usdRub) {
        return fallback.cnyRub;
    }

    return fx.usdRub;
}

function noteOf(fx: FxTable, fallback: FallbackRates, source: LandedUnit['fxUsed'] | undefined): string {
    const cny = fx.cnyRub ? `cny=${fx.cnyRub} dossier` : `cny=${fallback.cnyRub} fallback`;
    const usd = fx.usdRub ? `usd=${fx.usdRub} dossier` : `usd=${fallback.usdRub} fallback`;
    const used = source ?? 'нет заводской цены';

    return `курс:${used}; ${cny}; ${usd}`;
}
