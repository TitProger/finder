import { MarketPriceLayer } from '../enums/market-price-layer.enum';

export type FxSource = 'dossier' | 'fallback' | 'rub';

export type FxTable = {
    cnyRub?: number;
    usdRub?: number;
};

export type FallbackRates = {
    cnyRub: number;
    usdRub: number;
};

export type PricedOffer = {
    layer: string | null;
    unit: string | null;
    price: number;
    currency: string | null;
};

export type LayerQuote = {
    layer: MarketPriceLayer;
    unit: string;
    count: number;
    minRub: number;
    medianRub: number;
    fxUsed: FxSource;
};

export type EconomicsInput = {
    deliveryPerUnit: number;
    dutyPercent: number;
    otherCost: number;
    markupPercent: number;
};

export type LandedUnit = {
    unit: string;
    baseRub: number;
    deliveryPerUnit: number;
    dutyAmount: number;
    otherCost: number;
    markupAmount: number;
    landedRub: number;
    retailRub: number | null;
    deltaRub: number | null;
    verdict: 'выгодно' | 'не выгодно' | null;
    fxUsed: FxSource;
};

const LAYER_ORDER = [
    MarketPriceLayer.FACTORY,
    MarketPriceLayer.CHINA_OPEN,
    MarketPriceLayer.RUSSIA_RETAIL,
    MarketPriceLayer.RUSSIA_WHOLESALE,
];

const LAYERS = new Set<string>(LAYER_ORDER);

/**
 * Мин и медиана слоя в рублях. Штуки и комплекты не смешиваются.
 * Курс берётся из досье; если его нет — из запасных чисел, и это помечается.
 */
export function aggregateLayerPrices(
    offers: readonly PricedOffer[],
    fx: FxTable,
    fallback: FallbackRates,
): LayerQuote[] {
    const groups = new Map<string, { layer: MarketPriceLayer; unit: string; rub: number[]; sources: FxSource[] }>();

    for (const offer of offers) {
        if (!offer.layer || !LAYERS.has(offer.layer) || !Number.isFinite(offer.price) || offer.price < 0) {
            continue;
        }

        const converted = toRub(offer.price, offer.currency, fx, fallback);

        if (!converted) {
            continue;
        }

        const unit = offer.unit?.trim() || 'без единицы';
        const key = `${offer.layer}\0${unit}`;
        const group = groups.get(key) ?? {
            layer: offer.layer as MarketPriceLayer,
            unit,
            rub: [],
            sources: [],
        };

        group.rub.push(converted.rub);
        group.sources.push(converted.source);
        groups.set(key, group);
    }

    return [...groups.values()]
        .map((group) => ({
            layer: group.layer,
            unit: group.unit,
            count: group.rub.length,
            minRub: Math.min(...group.rub),
            medianRub: median(group.rub),
            fxUsed: groupSource(group.sources),
        }))
        .sort((left, right) => {
            const layerDelta = LAYER_ORDER.indexOf(left.layer) - LAYER_ORDER.indexOf(right.layer);

            if (layerDelta !== 0) {
                return layerDelta;
            }

            return left.unit.localeCompare(right.unit, 'ru');
        });
}

/**
 * Себестоимость за единицу от минимальной заводской цены.
 * Пошлина — процент от цены товара. Наценка — процент после доставки, пошлины и прочих.
 * Сравнение с розницей того же слоя единиц. Без розницы вердикта нет.
 */
export function landedUnits(quotes: readonly LayerQuote[], input: EconomicsInput): LandedUnit[] {
    const factory = quotes.filter((quote) => quote.layer === MarketPriceLayer.FACTORY);

    return factory.map((quote) => {
        const dutyAmount = (quote.minRub * input.dutyPercent) / 100;
        const subtotal = quote.minRub + input.deliveryPerUnit + input.otherCost + dutyAmount;
        const markupAmount = (subtotal * input.markupPercent) / 100;
        const landedRub = subtotal + markupAmount;
        const retail = quotes.find((item) => item.layer === MarketPriceLayer.RUSSIA_RETAIL && item.unit === quote.unit);
        const retailRub = retail ? retail.minRub : null;
        const deltaRub = retailRub === null ? null : retailRub - landedRub;

        return {
            unit: quote.unit,
            baseRub: quote.minRub,
            deliveryPerUnit: input.deliveryPerUnit,
            dutyAmount,
            otherCost: input.otherCost,
            markupAmount,
            landedRub,
            retailRub,
            deltaRub,
            verdict: deltaRub === null ? null : deltaRub > 0 ? 'выгодно' : 'не выгодно',
            fxUsed: quote.fxUsed,
        };
    });
}

export function formatLayerLines(quotes: readonly LayerQuote[]): string {
    if (quotes.length === 0) {
        return 'Слои в рублях, без логистики:\n—';
    }

    const lines = quotes.map((quote) => {
        const rate =
            quote.fxUsed === 'fallback' ? 'запасной курс' : quote.fxUsed === 'dossier' ? 'курс досье' : 'уже RUB';

        return `${quote.layer} / ${quote.unit}: мин ${formatMoney(quote.minRub)}, медиана ${formatMoney(quote.medianRub)}, ${rate}`;
    });

    return ['Слои в рублях, без логистики:', ...lines].join('\n');
}

export function readFxTable(raw: unknown): FxTable {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
    }

    const row = raw as Record<string, unknown>;

    return {
        cnyRub: positive(row.cny_rub ?? row.cnyRub),
        usdRub: positive(row.usd_rub ?? row.usdRub),
    };
}

export function readFallbackRates(): FallbackRates {
    return {
        cnyRub: readRateEnv('FX_FALLBACK_CNY_RUB', 12.3),
        usdRub: readRateEnv('FX_FALLBACK_USD_RUB', 90),
    };
}

function toRub(
    price: number,
    currency: string | null,
    fx: FxTable,
    fallback: FallbackRates,
): { rub: number; source: FxSource } | null {
    const code = (currency ?? '').trim().toUpperCase();

    if (code === 'RUB') {
        return { rub: price, source: 'rub' };
    }

    if (code === 'CNY') {
        if (fx.cnyRub) {
            return { rub: price * fx.cnyRub, source: 'dossier' };
        }

        return { rub: price * fallback.cnyRub, source: 'fallback' };
    }

    if (code === 'USD') {
        if (fx.usdRub) {
            return { rub: price * fx.usdRub, source: 'dossier' };
        }

        return { rub: price * fallback.usdRub, source: 'fallback' };
    }

    return null;
}

function median(values: readonly number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 1) {
        return sorted[mid];
    }

    return (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupSource(sources: readonly FxSource[]): FxSource {
    if (sources.includes('fallback')) {
        return 'fallback';
    }

    if (sources.includes('dossier')) {
        return 'dossier';
    }

    return 'rub';
}

function positive(value: unknown): number | undefined {
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

    if (!Number.isFinite(number) || number <= 0) {
        return undefined;
    }

    return number;
}

function readRateEnv(name: string, fallback: number): number {
    const raw = process.env[name];

    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value <= 0) {
        return fallback;
    }

    return value;
}

function formatMoney(value: number): string {
    return Object.is(value, -0) ? '0' : String(Math.round(value * 100) / 100);
}
