/**
 * Откуда взято измерение. inferred нельзя подавать в логистику.
 */
export enum FactOrigin {
    USER = 'user',
    VERIFIED = 'verified',
    INFERRED = 'inferred',
}
