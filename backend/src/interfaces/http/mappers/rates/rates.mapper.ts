import { LogisticsRateEntity } from '../../../../domain/entities/rates/logistics-rate.entity';
import {
    MarginResult,
    QuoteResult,
} from '../../../../domain/market/logistics-calculator';
import type {
    LogisticsQuoteResult,
    LogisticsRate,
    MarginEstimateResult,
} from '../../generated/responses/rates';

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

function toNumber(value: string): number {
    return Number(value);
}

export class RatesMapper {
    static toRate(entity: LogisticsRateEntity): LogisticsRate {
        return {
            id: entity.id,
            mode: entity.mode,
            label: entity.label,
            originPlace: entity.originPlace,
            destination: entity.destination,
            currency: entity.currency,
            pricePerKg: toNumber(entity.pricePerKg),
            fxToRub: toNumber(entity.fxToRub),
            minCharge: toNumber(entity.minCharge),
            transitDaysMin: entity.transitDaysMin,
            transitDaysMax: entity.transitDaysMax,
            included: [...entity.included],
            isActive: entity.isActive,
            createdAt: entity.createdAt.toISOString(),
            updatedAt: toIso(entity.updatedAt),
        };
    }

    static toQuote(result: QuoteResult): LogisticsQuoteResult {
        return result;
    }

    static toMargin(result: MarginResult): MarginEstimateResult {
        return result;
    }
}
