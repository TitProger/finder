import { Inject, Injectable } from '@nestjs/common';

import { AppMessages } from '@/application/messages';
import {
    RATES_SERVICE,
    RatesService,
} from '@/application/services/contracts/rates/rates.service';
import { ServiceResult } from '../../../common/service-result.interface';
import type {
    CreateLogisticsRateRequest,
    LogisticsQuoteRequest,
    MarginEstimateRequest,
    UpdateLogisticsRateRequest,
} from '../../../generated/requests/rates';
import type {
    LogisticsQuoteResult,
    LogisticsRate,
    MarginEstimateResult,
} from '../../../generated/responses/rates';
import { RatesMapper } from '../../../mappers/rates/rates.mapper';

export type RatesListQuery = {
    page?: number;
    limit?: number;
    activeOnly?: boolean;
};

@Injectable()
export class RatesHttpService {
    constructor(
        @Inject(RATES_SERVICE)
        private readonly rates: RatesService,
    ) {}

    async list(query: RatesListQuery): Promise<ServiceResult<LogisticsRate[]>> {
        const result = await this.rates.list(query);
        const totalPages = result.limit > 0 ? Math.ceil(result.total / result.limit) : 0;

        return {
            data: result.items.map(RatesMapper.toRate),
            message: AppMessages.common.listed,
            page: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages,
            },
        };
    }

    async getById(id: string): Promise<ServiceResult<LogisticsRate>> {
        const entity = await this.rates.getById(id);

        return { data: RatesMapper.toRate(entity), message: AppMessages.common.fetched };
    }

    async create(body: CreateLogisticsRateRequest): Promise<ServiceResult<LogisticsRate>> {
        const entity = await this.rates.create(body);

        return { data: RatesMapper.toRate(entity), message: AppMessages.common.created };
    }

    async update(id: string, body: UpdateLogisticsRateRequest): Promise<ServiceResult<LogisticsRate>> {
        const entity = await this.rates.update(id, body);

        return { data: RatesMapper.toRate(entity), message: AppMessages.common.updated };
    }

    async remove(id: string): Promise<ServiceResult<null>> {
        await this.rates.remove(id);

        return { data: null, message: AppMessages.common.deleted };
    }

    async quote(body: LogisticsQuoteRequest): Promise<ServiceResult<LogisticsQuoteResult>> {
        const result = await this.rates.quote({
            weight: body.weight,
            quantity: body.quantity,
            originPlace: body.originPlace,
            destination: body.destination,
            mode: body.mode,
        });

        return { data: RatesMapper.toQuote(result), message: AppMessages.common.fetched };
    }

    async estimateMargin(body: MarginEstimateRequest): Promise<ServiceResult<MarginEstimateResult>> {
        const result = await this.rates.estimateMargin({
            productCostRub: body.productCostRub,
            deliveryPerUnitRub: body.deliveryPerUnitRub,
            dutyPercent: body.dutyPercent,
            otherCostRub: body.otherCostRub,
            salePriceRub: body.salePriceRub,
        });

        return { data: RatesMapper.toMargin(result), message: AppMessages.common.fetched };
    }
}
