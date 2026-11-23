/**
 * Детерминированный расчёт логистики и маржи по книге ставок.
 * Модель сюда не зовётся. Один вход + те же ставки → один результат.
 */

export type FactOriginValue = 'user' | 'verified' | 'inferred';

export type MeasuredWeightInput = {
    valueKg: number;
    origin: FactOriginValue;
    confidence?: number | null;
};

export type RateBookEntry = {
    id: string;
    mode: string;
    label: string;
    originPlace: string;
    destination: string;
    currency: string;
    pricePerKg: number;
    fxToRub: number;
    minCharge: number;
    transitDaysMin: number;
    transitDaysMax: number;
    included: string[];
    isActive: boolean;
};

export type QuoteInput = {
    weight: MeasuredWeightInput;
    quantity: number;
    originPlace?: string | null;
    destination: string;
    mode?: string | null;
};

export type QuoteUnavailable = {
    status: 'unavailable';
    reason: 'rates_not_configured' | 'no_matching_rate';
};

export type QuoteOk = {
    status: 'ok';
    rateId: string;
    mode: string;
    label: string;
    currency: string;
    pricePerKg: number;
    fxToRub: number;
    weightKg: number;
    quantity: number;
    perUnitRub: number;
    perBatchRub: number;
    transitDaysMin: number;
    transitDaysMax: number;
    included: string[];
};

export type QuoteResult = QuoteUnavailable | QuoteOk;

export type MarginInput = {
    productCostRub: number;
    deliveryPerUnitRub: number;
    dutyPercent?: number;
    otherCostRub?: number;
    salePriceRub?: number | null;
};

export type MarginUnavailable = {
    status: 'unavailable';
    reason: 'invalid_input';
    disclaimer: string;
};

export type MarginOk = {
    status: 'ok';
    costWithDeliveryRub: number;
    expenses: Array<{ label: string; amountRub: number }>;
    marginRub: number | null;
    marginPercent: number | null;
    disclaimer: string;
};

export type MarginResult = MarginUnavailable | MarginOk;

export const MARGIN_DISCLAIMER = 'Оценка с учётом расходов, не факт прибыли.';

export class InferredWeightError extends Error {
    readonly code = 'RATES_INFERRED_WEIGHT';

    constructor() {
        super('Вес с origin=inferred в калькулятор логистики не подаётся');
        this.name = 'InferredWeightError';
    }
}

/**
 * Считает доставку по активным ставкам.
 * Пустая книга → rates_not_configured. Нет совпадения → no_matching_rate.
 * Вес inferred бросает InferredWeightError до арифметики.
 */
export function quoteLogistics(rates: readonly RateBookEntry[], input: QuoteInput): QuoteResult {
    assertWeightAllowed(input.weight);

    const active = rates.filter((rate) => rate.isActive);

    if (active.length === 0) {
        return { status: 'unavailable', reason: 'rates_not_configured' };
    }

    const destination = normalizePlace(input.destination);
    const originPlace = input.originPlace != null && input.originPlace !== '' ? normalizePlace(input.originPlace) : null;
    const mode = input.mode != null && input.mode !== '' ? normalizeToken(input.mode) : null;

    const match = active.find((rate) => {
        if (normalizePlace(rate.destination) !== destination) {
            return false;
        }

        if (originPlace && normalizePlace(rate.originPlace) !== originPlace) {
            return false;
        }

        if (mode && normalizeToken(rate.mode) !== mode) {
            return false;
        }

        return true;
    });

    if (!match) {
        return { status: 'unavailable', reason: 'no_matching_rate' };
    }

    const weightKg = roundMoney(input.weight.valueKg);
    const quantity = roundMoney(input.quantity);
    const gross = weightKg * quantity * match.pricePerKg;
    const charge = Math.max(gross, match.minCharge);
    const perBatchRub = roundMoney(charge * match.fxToRub);
    const perUnitRub = roundMoney(perBatchRub / quantity);

    return {
        status: 'ok',
        rateId: match.id,
        mode: match.mode,
        label: match.label,
        currency: match.currency,
        pricePerKg: match.pricePerKg,
        fxToRub: match.fxToRub,
        weightKg,
        quantity,
        perUnitRub,
        perBatchRub,
        transitDaysMin: match.transitDaysMin,
        transitDaysMax: match.transitDaysMax,
        included: [...match.included],
    };
}

/**
 * Оценка маржи. Пошлина — процент от цены товара.
 * Без цены продажи marginRub/marginPercent = null.
 */
export function estimateMargin(input: MarginInput): MarginResult {
    const productCostRub = input.productCostRub;
    const deliveryPerUnitRub = input.deliveryPerUnitRub;
    const dutyPercent = input.dutyPercent ?? 0;
    const otherCostRub = input.otherCostRub ?? 0;
    const salePriceRub = input.salePriceRub ?? null;

    if (![productCostRub, deliveryPerUnitRub, dutyPercent, otherCostRub].every(isNonNegativeFinite)) {
        return { status: 'unavailable', reason: 'invalid_input', disclaimer: MARGIN_DISCLAIMER };
    }

    if (salePriceRub !== null && !isNonNegativeFinite(salePriceRub)) {
        return { status: 'unavailable', reason: 'invalid_input', disclaimer: MARGIN_DISCLAIMER };
    }

    const dutyAmount = roundMoney((productCostRub * dutyPercent) / 100);
    const costWithDeliveryRub = roundMoney(productCostRub + deliveryPerUnitRub + dutyAmount + otherCostRub);
    const expenses = [
        { label: 'Товар', amountRub: roundMoney(productCostRub) },
        { label: 'Логистика', amountRub: roundMoney(deliveryPerUnitRub) },
        { label: 'Пошлина', amountRub: dutyAmount },
        { label: 'Прочее', amountRub: roundMoney(otherCostRub) },
    ];

    if (salePriceRub === null) {
        return {
            status: 'ok',
            costWithDeliveryRub,
            expenses,
            marginRub: null,
            marginPercent: null,
            disclaimer: MARGIN_DISCLAIMER,
        };
    }

    const marginRub = roundMoney(salePriceRub - costWithDeliveryRub);
    const marginPercent = salePriceRub > 0 ? roundMoney((marginRub / salePriceRub) * 100) : null;

    return {
        status: 'ok',
        costWithDeliveryRub,
        expenses,
        marginRub,
        marginPercent,
        disclaimer: MARGIN_DISCLAIMER,
    };
}

function assertWeightAllowed(weight: MeasuredWeightInput): void {
    if (weight.origin === 'inferred') {
        throw new InferredWeightError();
    }

    if (!Number.isFinite(weight.valueKg) || weight.valueKg <= 0) {
        throw new Error('Вес должен быть числом больше нуля');
    }
}

function normalizePlace(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeToken(value: string): string {
    return value.trim().toLowerCase();
}

function isNonNegativeFinite(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
}

/** Деньги и веса округляем до копеек/граммов в фиксированной шкале. */
export function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}
