/**
 * Безопасный отчёт, который лежит в jsonb public_report.
 * Контакты и сырая закупка сюда не входят.
 */

export type SafeDossierSource = {
    url: string;
    capturedAt: string;
    quote?: string | null;
};

export type SafeDossierReportBody = {
    name: string;
    categoryLabel: string;
    manufacturer?: string | null;
    summary?: string | null;
    typicalPrice: string | null;
    lowestCrediblePrice: string | null;
    currency: string | null;
    moqLabel: string | null;
    conditions: string | null;
    sources: SafeDossierSource[];
    delivery: {
        available: boolean;
        demo: boolean;
        title: string;
        modes?: string[];
        perUnit?: {
            caption: string;
            price: string;
            priceSuffix?: string | null;
            detail?: string | null;
        } | null;
        perBatch?: {
            caption: string;
            price: string;
            priceSuffix?: string | null;
            detail?: string | null;
        } | null;
        included?: string[];
    };
    disclaimer: string;
    photos: { url: string; alt: string }[];
    specs: { label: string; value: string }[];
    procurement?: {
        title: string;
        moqLabel: string;
        tiers: Array<{
            title: string;
            price: string;
            priceUnit?: string | null;
            converted?: string | null;
            note: string;
            badge?: string | null;
            highlighted: boolean;
        }>;
    } | null;
    market?: {
        title: string;
        sellersLabel: string;
        quotes: Array<{
            title: string;
            price: string;
            note: string;
            highlighted: boolean;
        }>;
    } | null;
    breakdown?: {
        title: string;
        verdict: string;
        stars: number;
        costPrice: string;
        costSuffix?: string | null;
        costNote: string;
        profitPrice: string;
        profitExtra?: string | null;
        profitNote: string;
        saleLabel: string;
        marginLabel: string;
        segments: Array<{
            label: string;
            sharePercent: number;
            tone: string;
        }>;
    } | null;
};

export type SafeDossierReport = SafeDossierReportBody & {
    id: string;
    matchKind: 'exact' | 'similar' | null;
    revalidateAt: string | null;
};
