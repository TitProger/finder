import { appError } from './types';

export const EconomicsErrors = {
    badInput: appError('ECONOMICS_BAD_INPUT', 'Не удалось прочитать экономику заявки'),
} as const;
