import {
    estimateMargin,
    InferredWeightError,
    MARGIN_DISCLAIMER,
    quoteLogistics,
    RateBookEntry,
} from './logistics-calculator';

const FIXTURE_RATE: RateBookEntry = {
    id: '11111111-1111-4111-8111-111111111111',
    mode: 'cargo',
    label: 'Карго быстрая',
    originPlace: 'guangzhou',
    destination: 'moscow',
    currency: 'USD',
    pricePerKg: 1.85,
    fxToRub: 90,
    minCharge: 0,
    transitDaysMin: 14,
    transitDaysMax: 18,
    included: ['Страховка'],
    isActive: true,
};

const INPUT = {
    weight: { valueKg: 1.85, origin: 'verified' as const },
    quantity: 500,
    originPlace: 'guangzhou',
    destination: 'moscow',
    mode: 'cargo',
};

describe('quoteLogistics', () => {
    it('пустая книга → rates_not_configured', () => {
        expect(quoteLogistics([], INPUT)).toEqual({
            status: 'unavailable',
            reason: 'rates_not_configured',
        });
    });

    it('только неактивные → rates_not_configured', () => {
        expect(quoteLogistics([{ ...FIXTURE_RATE, isActive: false }], INPUT)).toEqual({
            status: 'unavailable',
            reason: 'rates_not_configured',
        });
    });

    it('один и тот же вход при фикстуре даёт один расчёт', () => {
        const first = quoteLogistics([FIXTURE_RATE], INPUT);
        const second = quoteLogistics([FIXTURE_RATE], INPUT);

        expect(first).toEqual(second);
        // 1.85 кг × 500 шт × $1.85 × 90 ₽ = 154012.5 ₽; за штуку 308.02 ₽
        expect(first).toMatchObject({
            status: 'ok',
            rateId: FIXTURE_RATE.id,
            weightKg: 1.85,
            quantity: 500,
            perBatchRub: 154012.5,
            perUnitRub: 308.02,
        });
    });

    it('вес origin=inferred не подаётся в калькулятор', () => {
        expect(() =>
            quoteLogistics([FIXTURE_RATE], {
                ...INPUT,
                weight: { valueKg: 1.85, origin: 'inferred' },
            }),
        ).toThrow(InferredWeightError);
    });

    it('нет совпадения маршрута → no_matching_rate', () => {
        expect(
            quoteLogistics([FIXTURE_RATE], {
                ...INPUT,
                destination: 'spb',
            }),
        ).toEqual({ status: 'unavailable', reason: 'no_matching_rate' });
    });
});

describe('estimateMargin', () => {
    it('считает оценку с расходами и оговоркой', () => {
        const result = estimateMargin({
            productCostRub: 920,
            deliveryPerUnitRub: 340,
            dutyPercent: 0,
            otherCostRub: 0,
            salePriceRub: 3900,
        });

        expect(result).toEqual({
            status: 'ok',
            costWithDeliveryRub: 1260,
            expenses: [
                { label: 'Товар', amountRub: 920 },
                { label: 'Логистика', amountRub: 340 },
                { label: 'Пошлина', amountRub: 0 },
                { label: 'Прочее', amountRub: 0 },
            ],
            marginRub: 2640,
            marginPercent: 67.69,
            disclaimer: MARGIN_DISCLAIMER,
        });
    });

    it('без цены продажи маржа null', () => {
        const result = estimateMargin({
            productCostRub: 100,
            deliveryPerUnitRub: 20,
            salePriceRub: null,
        });

        expect(result).toMatchObject({
            status: 'ok',
            costWithDeliveryRub: 120,
            marginRub: null,
            marginPercent: null,
            disclaimer: MARGIN_DISCLAIMER,
        });
    });
});
