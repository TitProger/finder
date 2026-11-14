const SOURCE_URL_MAX = 2048;

export type KeptOffer = {
    index: number;
    sourceUrl: string;
    quote: string;
    body: Record<string, unknown>;
};

export type DiscardedOffer = {
    index: number;
    path: string;
    reason: string;
};

export type PartitionedOffers = {
    kept: KeptOffer[];
    discarded: DiscardedOffer[];
};

/**
 * Оффер без http(s) source_url или без quote не становится строкой offer.
 * Причина возвращается в ответе приёма и пишется в research_run.discarded.
 */
export function partitionOffers(items: readonly unknown[]): PartitionedOffers {
    const kept: KeptOffer[] = [];
    const discarded: DiscardedOffer[] = [];

    for (let index = 0; index < items.length; index += 1) {
        const decision = decideOffer(items[index], index);

        if (decision.kind === 'keep') {
            kept.push(decision.offer);
        } else {
            discarded.push({ index, path: `offers[${index}]`, reason: decision.reason });
        }
    }

    return { kept, discarded };
}

function decideOffer(
    item: unknown,
    index: number,
): { kind: 'keep'; offer: KeptOffer } | { kind: 'drop'; reason: string } {
    const body = asRecord(item);

    if (!body) {
        return { kind: 'drop', reason: 'нет source_url' };
    }

    const url = readText(body.source_url ?? body.sourceUrl);

    if (!url) {
        return { kind: 'drop', reason: 'нет source_url' };
    }

    const quote = readText(body.quote ?? body.quoteText);

    if (!quote) {
        return { kind: 'drop', reason: 'нет quote' };
    }

    if (!isHttpUrl(url)) {
        return { kind: 'drop', reason: 'source_url не http(s)' };
    }

    if (url.length > SOURCE_URL_MAX) {
        return { kind: 'drop', reason: 'source_url длиннее 2048 символов' };
    }

    return { kind: 'keep', offer: { index, sourceUrl: url, quote, body } };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function readText(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const text = value.trim();

    return text === '' ? null : text;
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);

        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}
