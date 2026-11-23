import { appError } from './types';

export const RatesErrors = {
    notFound: appError('RATES_NOT_FOUND', 'Ставка не найдена'),
    badInput: appError('RATES_BAD_INPUT', 'Некорректные данные ставки или расчёта'),
    inferredWeight: appError(
        'RATES_INFERRED_WEIGHT',
        'Вес с origin=inferred в калькулятор логистики не подаётся',
    ),
} as const;
