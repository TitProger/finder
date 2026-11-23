import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { LogisticsRateEntity } from '../../../../domain/entities/rates/logistics-rate.entity';
import {
    estimateMargin,
    InferredWeightError,
    quoteLogistics,
    RateBookEntry,
} from '../../../../domain/market/logistics-calculator';
import {
    LogisticsRateListQuery,
    LogisticsRateListResult,
    LogisticsRateRepository,
} from '../../../../domain/repositories/rates/logistics-rate.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import {
    CreateLogisticsRateInput,
    EstimateMarginInput,
    QuoteLogisticsInput,
    RatesService,
    UpdateLogisticsRateInput,
} from '../../contracts/rates/rates.service';

/**
 * Книга ставок и калькуляторы. Модель логистику не считает.
 */
@Injectable()
export class RatesServiceImpl implements RatesService {
    constructor(
        @Inject(REPOSITORY_TOKENS.LOGISTICS_RATE_REPOSITORY)
        private readonly rates: LogisticsRateRepository,
    ) {}

    list(query: LogisticsRateListQuery): Promise<LogisticsRateListResult> {
        return this.rates.list(query);
    }

    async getById(id: string): Promise<LogisticsRateEntity> {
        return this.require(id);
    }

    async create(input: CreateLogisticsRateInput): Promise<LogisticsRateEntity> {
        this.assertRateNumbers(input);

        const row = new LogisticsRateEntity();

        applyCreate(row, input);

        const em = this.rates.getEntityManager();

        em.persist(row);
        await em.flush();

        return this.require(row.id);
    }

    async update(id: string, input: UpdateLogisticsRateInput): Promise<LogisticsRateEntity> {
        this.assertRateNumbers(input);

        const row = await this.require(id);

        applyUpdate(row, input);

        const em = this.rates.getEntityManager();

        em.persist(row);
        await em.flush();

        return this.require(row.id);
    }

    async remove(id: string): Promise<void> {
        const row = await this.require(id);
        const em = this.rates.getEntityManager();

        em.remove(row);
        await em.flush();
    }

    async quote(input: QuoteLogisticsInput) {
        if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
            throw new BadRequestAppException(AppErrors.rates.badInput.message, {
                code: AppErrors.rates.badInput.code,
            });
        }

        const active = await this.rates.findActive();

        try {
            return quoteLogistics(active.map(toBookEntry), input);
        } catch (error) {
            if (error instanceof InferredWeightError) {
                throw new BadRequestAppException(AppErrors.rates.inferredWeight.message, {
                    code: AppErrors.rates.inferredWeight.code,
                });
            }

            throw new BadRequestAppException(
                error instanceof Error ? error.message : AppErrors.rates.badInput.message,
                { code: AppErrors.rates.badInput.code },
            );
        }
    }

    async estimateMargin(input: EstimateMarginInput) {
        return estimateMargin(input);
    }

    private async require(id: string): Promise<LogisticsRateEntity> {
        const row = await this.rates.findOne({ id });

        if (!row) {
            throw new NotFoundAppException(AppErrors.rates.notFound.message, {
                code: AppErrors.rates.notFound.code,
            });
        }

        return row;
    }

    private assertRateNumbers(input: CreateLogisticsRateInput | UpdateLogisticsRateInput): void {
        const fields: Array<[unknown, string]> = [
            [input.pricePerKg, 'pricePerKg'],
            [input.fxToRub, 'fxToRub'],
            [input.minCharge, 'minCharge'],
        ];

        for (const [value, name] of fields) {
            if (value === undefined) {
                continue;
            }

            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                throw new BadRequestAppException(`${name}: число не меньше нуля`, {
                    code: AppErrors.rates.badInput.code,
                });
            }
        }

        if (input.fxToRub !== undefined && input.fxToRub <= 0) {
            throw new BadRequestAppException('fxToRub должен быть больше нуля', {
                code: AppErrors.rates.badInput.code,
            });
        }

        if (
            input.transitDaysMin !== undefined &&
            input.transitDaysMax !== undefined &&
            input.transitDaysMax < input.transitDaysMin
        ) {
            throw new BadRequestAppException('transitDaysMax меньше transitDaysMin', {
                code: AppErrors.rates.badInput.code,
            });
        }
    }
}

function applyCreate(row: LogisticsRateEntity, input: CreateLogisticsRateInput): void {
    row.mode = input.mode.trim();
    row.label = input.label.trim();
    row.originPlace = input.originPlace.trim().toLowerCase();
    row.destination = input.destination.trim().toLowerCase();
    row.currency = input.currency.trim().toUpperCase();
    row.pricePerKg = decimal(input.pricePerKg);
    row.fxToRub = decimal(input.fxToRub);
    row.minCharge = decimal(input.minCharge ?? 0);
    row.transitDaysMin = input.transitDaysMin ?? 0;
    row.transitDaysMax = input.transitDaysMax ?? 0;
    row.included = [...(input.included ?? [])];
    row.isActive = input.isActive ?? true;
}

function applyUpdate(row: LogisticsRateEntity, input: UpdateLogisticsRateInput): void {
    if (input.mode !== undefined) {
        row.mode = input.mode.trim();
    }

    if (input.label !== undefined) {
        row.label = input.label.trim();
    }

    if (input.originPlace !== undefined) {
        row.originPlace = input.originPlace.trim().toLowerCase();
    }

    if (input.destination !== undefined) {
        row.destination = input.destination.trim().toLowerCase();
    }

    if (input.currency !== undefined) {
        row.currency = input.currency.trim().toUpperCase();
    }

    if (input.pricePerKg !== undefined) {
        row.pricePerKg = decimal(input.pricePerKg);
    }

    if (input.fxToRub !== undefined) {
        row.fxToRub = decimal(input.fxToRub);
    }

    if (input.minCharge !== undefined) {
        row.minCharge = decimal(input.minCharge);
    }

    if (input.transitDaysMin !== undefined) {
        row.transitDaysMin = input.transitDaysMin;
    }

    if (input.transitDaysMax !== undefined) {
        row.transitDaysMax = input.transitDaysMax;
    }

    if (input.included !== undefined) {
        row.included = [...input.included];
    }

    if (input.isActive !== undefined) {
        row.isActive = input.isActive;
    }
}

function toBookEntry(row: LogisticsRateEntity): RateBookEntry {
    return {
        id: row.id,
        mode: row.mode,
        label: row.label,
        originPlace: row.originPlace,
        destination: row.destination,
        currency: row.currency,
        pricePerKg: Number(row.pricePerKg),
        fxToRub: Number(row.fxToRub),
        minCharge: Number(row.minCharge),
        transitDaysMin: row.transitDaysMin,
        transitDaysMax: row.transitDaysMax,
        included: [...row.included],
        isActive: row.isActive,
    };
}

function decimal(value: number): string {
    return String(Math.round(value * 10000) / 10000);
}
