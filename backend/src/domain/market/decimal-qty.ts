/** Число количества для numeric-колонки. Диапазон сравнивается как число, не как строка. */
export function decimalString(value: number): string {
    if (!Number.isFinite(value)) {
        return 'NaN';
    }

    return Object.is(value, -0) ? '0' : String(value);
}

export function sameDecimal(left: string, right: string): boolean {
    const first = Number(left);
    const second = Number(right);

    return Number.isFinite(first) && Number.isFinite(second) && first === second;
}

export function decimalSpan(min: string, max: string): number {
    return Number(max) - Number(min);
}
