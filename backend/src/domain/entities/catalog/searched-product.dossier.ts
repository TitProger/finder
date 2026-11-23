/**
 * Текст карточки, который сид кладёт в jsonb.
 * Ссылки на файлы — id строк stored_file, не URL.
 */

export type SearchedProductPhotoRef = {
    fileId: string;
    alt: string;
};

export type SearchedProductPriceTier = {
    title: string;
    price: string;
    priceUnit?: string | null;
    converted?: string | null;
    note: string;
    badge?: string | null;
    highlighted: boolean;
};

export type SearchedProductProcurement = {
    title: string;
    moqLabel: string;
    tiers: SearchedProductPriceTier[];
};

export type SearchedProductDeliveryRate = {
    caption: string;
    price: string;
    priceSuffix?: string | null;
    detail?: string | null;
};

export type SearchedProductDelivery = {
    available: boolean;
    demo: boolean;
    title: string;
    modes?: string[];
    perUnit?: SearchedProductDeliveryRate | null;
    perBatch?: SearchedProductDeliveryRate | null;
    included?: string[];
};

export type SearchedProductMarketQuote = {
    title: string;
    price: string;
    note: string;
    highlighted: boolean;
};

export type SearchedProductMarket = {
    title: string;
    sellersLabel: string;
    quotes: SearchedProductMarketQuote[];
};

export type SearchedProductPriceSegment = {
    label: string;
    sharePercent: number;
    tone: string;
};

export type SearchedProductBreakdown = {
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
    segments: SearchedProductPriceSegment[];
};

export type SearchedProductDossier = {
    headline: string | null;
    cardCategoryLabel: string | null;
    manufacturer: string | null;
    oemLabel: string | null;
    summaryTitle: string | null;
    summary: string | null;
    availabilityLabel: string | null;
    demandLabel: string | null;
    galleryMoreLabel: string | null;
    verifiedLabel: string | null;
    updatedLabel: string | null;
    specsTitle: string | null;
    passportLabel: string | null;
    specs: { label: string; value: string }[];
    photos: SearchedProductPhotoRef[];
    procurement: SearchedProductProcurement | null;
    delivery: SearchedProductDelivery | null;
    market: SearchedProductMarket | null;
    breakdown: SearchedProductBreakdown | null;
};
