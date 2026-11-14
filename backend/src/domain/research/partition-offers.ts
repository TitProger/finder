const SOURCE_URL_MAX = 2048;
const QUOTE_SNIPPET = 120;

export type KeptOffer = {
    index: number;
    sourceUrl: string;
    body: Record<string, unknown>;
};

export type DiscardedOffer = {
    index: number;
    reason: string;
};

export type PartitionedOffers = {
    kept: KeptOffer[];
    discarded: DiscardedOffer[];
};

/**
 * Оффер без url невалиден и строкой offer не становится.
 * Причина остаётся текстом, её пишет прогон.
 */
export function partitionOffers(items: readonly unknown[]): PartitionedOffers {
    const kept: KeptOffer[] = [];
    const discarded: DiscardedOffer[] = [];

    for (let index = 0; index < items.length; index += 1) {
        const decision = decideOffer(items[index], index);

        if (decision.kind === 'keep') {
            kept.push(decision.offer);
        } else {
            discarded.push({ index, reason: decision.reason });
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
        return { kind: 'drop', reason: discardReason(index, 'нет url', null) };
    }

    const url = body.sourceUrl;

    if (typeof url !== 'string' || url.trim() === '') {
        return { kind: 'drop', reason: discardReason(index, 'нет url', readQuote(body.quoteText)) };
    }

    const sourceUrl = url.trim();

    if (sourceUrl.length > SOURCE_URL_MAX) {
        return {
            kind: 'drop',
            reason: discardReason(index, 'url длиннее 2048 символов', readQuote(body.quoteText)),
        };
    }

    return { kind: 'keep', offer: { index, sourceUrl, body } };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function readQuote(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const text = value.trim();

    if (text === '') {
        return null;
    }

    if (text.length <= QUOTE_SNIPPET) {
        return text;
    }

    return `${text.slice(0, QUOTE_SNIPPET - 3)}...`;
}

function discardReason(index: number, detail: string, quote: string | null): string {
    const head = `Оффер ${index + 1} отброшен: ${detail}.`;

    if (!quote) {
        return head;
    }

    return `${head} Цитата: «${quote}».`;
}
