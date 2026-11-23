import { LogisticsRateEntity } from '../../../../domain/entities/rates/logistics-rate.entity';
import {
    MarginResult,
    QuoteResult,
} from '../../../../domain/market/logistics-calculator';
import {
    LogisticsRateListQuery,
    LogisticsRateListResult,
} from '../../../../domain/repositories/rates/logistics-rate.repository';

export const RATES_SERVICE = Symbol('RATES_SERVICE');

export type CreateLogisticsRateInput = {
    mode: string;
    label: string;
    originPlace: string;
    destination: string;
    currency: string;
    pricePerKg: number;
    fxToRub: number;
    minCharge?: number;
    transitDaysMin?: number;
    transitDaysMax?: number;
    included?: string[];
    isActive?: boolean;
};

export type UpdateLogisticsRateInput = {
    mode?: string;
    label?: string;
    originPlace?: string;
    destination?: string;
    currency?: string;
    pricePerKg?: number;
    fxToRub?: number;
    minCharge?: number;
    transitDaysMin?: number;
    transitDaysMax?: number;
    included?: string[];
    isActive?: boolean;
};

export type QuoteLogisticsInput = {
    weight: {
        valueKg: number;
        origin: 'user' | 'verified' | 'inferred';
        confidence?: number | null;
    };
    quantity: number;
    originPlace?: string | null;
    destination: string;
    mode?: string | null;
};

export type EstimateMarginInput = {
    productCostRub: number;
    deliveryPerUnitRub: number;
    dutyPercent?: number;
    otherCostRub?: number;
    salePriceRub?: number | null;
};

export interface RatesService {
    list(query: LogisticsRateListQuery): Promise<LogisticsRateListResult>;
    getById(id: string): Promise<LogisticsRateEntity>;
    create(input: CreateLogisticsRateInput): Promise<LogisticsRateEntity>;
    update(id: string, input: UpdateLogisticsRateInput): Promise<LogisticsRateEntity>;
    remove(id: string): Promise<void>;
    quote(input: QuoteLogisticsInput): Promise<QuoteResult>;
    estimateMargin(input: EstimateMarginInput): Promise<MarginResult>;
}
