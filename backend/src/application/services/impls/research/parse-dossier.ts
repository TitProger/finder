import { CompanyRegistryStatus } from '../../../../domain/enums/company-registry-status.enum';
import { MarketPriceLayer } from '../../../../domain/enums/market-price-layer.enum';
import { SupplierRole } from '../../../../domain/enums/supplier-role.enum';
import { OFFER_TTL_MS, SNAPSHOT_TTL_MS, addTtl } from '../../../../domain/research/dossier-clock';
import { KeptOffer, partitionOffers } from '../../../../domain/research/partition-offers';

const REGISTRY_STATUSES: readonly CompanyRegistryStatus[] = [
    CompanyRegistryStatus.ACTIVE,
    CompanyRegistryStatus.REVOKED,
    CompanyRegistryStatus.UNKNOWN,
    CompanyRegistryStatus.OTHER,
];

const SUPPLIER_ROLES: readonly SupplierRole[] = [
    SupplierRole.DIRECT_FACTORY,
    SupplierRole.FACTORY_WITH_EXPORTER,
    SupplierRole.TRADER,
    SupplierRole.UNVERIFIED,
    SupplierRole.DEALER_OR_LIST_PRICE,
];

const PRICE_LAYERS: readonly MarketPriceLayer[] = [
    MarketPriceLayer.RUSSIA_RETAIL,
    MarketPriceLayer.RUSSIA_WHOLESALE,
    MarketPriceLayer.CHINA_OPEN,
];

export class DossierShapeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DossierShapeError';
    }
}

export type ParsedStorefront = {
    ref: string;
    platformName: string;
    sellerExternalId: string | null;
    storefrontUrl: string;
    factoryLabels: unknown;
    city: string | null;
};

export type ParsedCompany = {
    ref: string;
    legalNameZh: string;
    unifiedSocialCreditCode: string | null;
    registryStatus: CompanyRegistryStatus;
    address: string | null;
    businessScope: string | null;
    insuredEmployeeCount: number | null;
    storefronts: ParsedStorefront[];
};

export type SamplePoint = {
    price: string | null;
    url: string | null;
    label: string | null;
};

export type ParsedOffer = {
    sourceUrl: string;
    companyRef: string | null;
    storefrontRef: string | null;
    price: string | null;
    currency: string | null;
    volumeTier: string | null;
    moq: string | null;
    quoteText: string | null;
    supplierRole: SupplierRole;
    capturedAt: Date;
    expiresAt: Date;
};

export type ParsedSnapshot = {
    layer: MarketPriceLayer;
    source: string;
    medianPrice: string | null;
    currency: string | null;
    spreadLow: string | null;
    spreadHigh: string | null;
    samplePoints: SamplePoint[] | null;
    capturedAt: Date;
    expiresAt: Date;
};

export type ParsedDossier = {
    companies: ParsedCompany[];
    offers: ParsedOffer[];
    snapshots: ParsedSnapshot[];
    discarded: { index: number; reason: string }[];
};

export function parseDossier(raw: unknown, now: Date): ParsedDossier {
    const body = asRecord(raw, 'Досье');
    const companies = parseCompanies(readArray(body.companies, 'Список компаний'));
    const companyByRef = new Map<string, ParsedCompany>(
        companies.map((company) => [company.ref, company] as [string, ParsedCompany]),
    );
    const storefrontByRef = new Map<string, { companyRef: string }>(
        companies.flatMap((company) =>
            company.storefronts.map(
                (shop) => [shop.ref, { companyRef: company.ref }] as [string, { companyRef: string }],
            ),
        ),
    );
    const partitioned = partitionOffers(readArray(body.offers, 'Список офферов'));
    const offers = partitioned.kept.map((offer) => parseOffer(offer, companyByRef, storefrontByRef, now));
    const snapshots = readArray(body.snapshots, 'Список снимков').map((item, index) => parseSnapshot(item, index, now));

    return {
        companies,
        offers,
        snapshots,
        discarded: partitioned.discarded,
    };
}

function parseCompanies(items: readonly unknown[]): ParsedCompany[] {
    const companies: ParsedCompany[] = [];
    const refs = new Set<string>();
    const creditCodes = new Set<string>();
    const sellers = new Set<string>();
    const storefrontRefs = new Set<string>();

    for (let index = 0; index < items.length; index += 1) {
        const label = `Компания ${index + 1}`;
        const body = asRecord(items[index], label);
        const ref = readRequiredText(body.ref, `${label}: ключ`, 64);

        if (refs.has(ref)) {
            throw new DossierShapeError(`${label}: ключ ${ref} повторяется`);
        }

        refs.add(ref);

        const unifiedSocialCreditCode = readOptionalText(body.unifiedSocialCreditCode, `${label}: код`, 32);

        if (unifiedSocialCreditCode) {
            if (creditCodes.has(unifiedSocialCreditCode)) {
                throw new DossierShapeError(`${label}: код ${unifiedSocialCreditCode} повторяется`);
            }

            creditCodes.add(unifiedSocialCreditCode);
        }

        const storefronts = readArray(body.storefronts, `${label}: витрины`).map((shop, shopIndex) =>
            parseStorefront(shop, shopIndex, storefrontRefs, sellers),
        );

        companies.push({
            ref,
            legalNameZh: readRequiredText(body.legalNameZh, `${label}: имя`, 512),
            unifiedSocialCreditCode,
            registryStatus: readRegistry(body.registryStatus, label),
            address: readOptionalText(body.address, `${label}: адрес`, 8000),
            businessScope: readOptionalText(body.businessScope, `${label}: сфера`, 8000),
            insuredEmployeeCount: readCount(body.insuredEmployeeCount, label),
            storefronts,
        });
    }

    return companies;
}

function parseStorefront(raw: unknown, index: number, refs: Set<string>, sellers: Set<string>): ParsedStorefront {
    const label = `Витрина ${index + 1}`;
    const body = asRecord(raw, label);
    const ref = readRequiredText(body.ref, `${label}: ключ`, 64);

    if (refs.has(ref)) {
        throw new DossierShapeError(`${label}: ключ ${ref} повторяется`);
    }

    refs.add(ref);

    const platformName = readRequiredText(body.platformName, `${label}: площадка`, 128);
    const sellerExternalId = readOptionalText(body.sellerExternalId, `${label}: id продавца`, 255);

    if (sellerExternalId) {
        const sellerKey = `${platformName}\0${sellerExternalId}`;

        if (sellers.has(sellerKey)) {
            throw new DossierShapeError(`${label}: продавец ${sellerExternalId} на ${platformName} повторяется`);
        }

        sellers.add(sellerKey);
    }

    return {
        ref,
        platformName,
        sellerExternalId,
        storefrontUrl: readRequiredText(body.storefrontUrl, `${label}: ссылка`, 2048),
        factoryLabels: readLabels(body.factoryLabels, label),
        city: readOptionalText(body.city, `${label}: город`, 255),
    };
}

function parseOffer(
    kept: KeptOffer,
    companies: Map<string, ParsedCompany>,
    storefronts: Map<string, { companyRef: string }>,
    now: Date,
): ParsedOffer {
    const label = `Оффер ${kept.index + 1}`;
    const body = kept.body;
    const companyRef = readOptionalText(body.companyRef, `${label}: компания`, 64);
    const storefrontRef = readOptionalText(body.storefrontRef, `${label}: витрина`, 64);

    if (companyRef && !companies.has(companyRef)) {
        throw new DossierShapeError(`${label}: неизвестная компания ${companyRef}`);
    }

    const owner = storefrontRef ? storefronts.get(storefrontRef) : undefined;

    if (storefrontRef && !owner) {
        throw new DossierShapeError(`${label}: неизвестная витрина ${storefrontRef}`);
    }

    if (owner && companyRef && owner.companyRef !== companyRef) {
        throw new DossierShapeError(`${label}: витрина не этой компании`);
    }

    const capturedAt = readDate(body.capturedAt, `${label}: дата съёма`) ?? now;
    const expiresAt = readDate(body.expiresAt, `${label}: срок`) ?? addTtl(capturedAt, OFFER_TTL_MS);

    assertExpiry(capturedAt, expiresAt, label);

    return {
        sourceUrl: kept.sourceUrl,
        companyRef: companyRef ?? owner?.companyRef ?? null,
        storefrontRef,
        price: readDecimal(body.price, `${label}: цена`),
        currency: readCurrency(body.currency, `${label}: валюта`),
        volumeTier: readOptionalText(body.volumeTier, `${label}: ступень объёма`, 8000),
        moq: readDecimal(body.moq, `${label}: MOQ`),
        quoteText: readOptionalText(body.quoteText, `${label}: цитата`, 8000),
        supplierRole: readSupplierRole(body.supplierRole, label),
        capturedAt,
        expiresAt,
    };
}

function parseSnapshot(raw: unknown, index: number, now: Date): ParsedSnapshot {
    const label = `Снимок ${index + 1}`;
    const body = asRecord(raw, label);
    const capturedAt = readDate(body.capturedAt, `${label}: дата съёма`) ?? now;
    const expiresAt = readDate(body.expiresAt, `${label}: срок`) ?? addTtl(capturedAt, SNAPSHOT_TTL_MS);

    assertExpiry(capturedAt, expiresAt, label);

    const spreadLow = readDecimal(body.spreadLow, `${label}: нижняя граница`);
    const spreadHigh = readDecimal(body.spreadHigh, `${label}: верхняя граница`);

    if (spreadLow !== null && spreadHigh !== null && Number(spreadLow) > Number(spreadHigh)) {
        throw new DossierShapeError(`${label}: нижняя граница выше верхней`);
    }

    return {
        layer: readLayer(body.layer, label),
        source: readRequiredText(body.source, `${label}: источник`, 255),
        medianPrice: readDecimal(body.medianPrice, `${label}: медиана`),
        currency: readCurrency(body.currency, `${label}: валюта`),
        spreadLow,
        spreadHigh,
        samplePoints: readSamplePoints(body.samplePoints, label),
        capturedAt,
        expiresAt,
    };
}

function readRegistry(value: unknown, label: string): CompanyRegistryStatus {
    if (value === undefined || value === null) {
        return CompanyRegistryStatus.UNKNOWN;
    }

    if (!isOneOf(value, REGISTRY_STATUSES)) {
        throw new DossierShapeError(`${label}: статус реестра не из списка`);
    }

    return value;
}

function readSupplierRole(value: unknown, label: string): SupplierRole {
    if (value === undefined || value === null) {
        return SupplierRole.UNVERIFIED;
    }

    if (!isOneOf(value, SUPPLIER_ROLES)) {
        throw new DossierShapeError(`${label}: роль поставщика не из списка`);
    }

    return value;
}

function readLayer(value: unknown, label: string): MarketPriceLayer {
    if (!isOneOf(value, PRICE_LAYERS)) {
        throw new DossierShapeError(`${label}: слой не из списка`);
    }

    return value;
}

function readSamplePoints(value: unknown, label: string): SamplePoint[] | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (!Array.isArray(value)) {
        throw new DossierShapeError(`${label}: примеры должны быть массивом`);
    }

    return value.map((point, index) => {
        const pointLabel = `${label}, пример ${index + 1}`;
        const body = asRecord(point, pointLabel);

        return {
            price: readDecimal(body.price, `${pointLabel}: цена`),
            url: readOptionalText(body.url, `${pointLabel}: url`, 2048),
            label: readOptionalText(body.label, `${pointLabel}: метка`, 255),
        };
    });
}

function readLabels(value: unknown, label: string): unknown {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== 'object') {
        throw new DossierShapeError(`${label}: метки должны быть объектом или массивом`);
    }

    return value;
}

function readCount(value: unknown, label: string): number | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new DossierShapeError(`${label}: число сотрудников должно быть целым от нуля`);
    }

    return value;
}

function readArray(value: unknown, label: string): unknown[] {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new DossierShapeError(`${label} должен быть массивом`);
    }

    return value;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new DossierShapeError(`${label} должен быть объектом`);
    }

    return value as Record<string, unknown>;
}

function readRequiredText(value: unknown, label: string, max: number): string {
    const text = readOptionalText(value, label, max);

    if (!text) {
        throw new DossierShapeError(`${label} пустой`);
    }

    return text;
}

function readOptionalText(value: unknown, label: string, max: number): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== 'string') {
        throw new DossierShapeError(`${label} должен быть текстом`);
    }

    const text = value.trim();

    if (text === '') {
        return null;
    }

    if (text.length > max) {
        throw new DossierShapeError(`${label} длиннее ${max}`);
    }

    return text;
}

function readDecimal(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const text = typeof value === 'number' ? formatNumber(value) : value;

    if (typeof text !== 'string' || !/^-?\d+(\.\d+)?$/.test(text.trim())) {
        throw new DossierShapeError(`${label} не число`);
    }

    return text.trim();
}

function formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return 'NaN';
    }

    return Object.is(value, -0) ? '0' : String(value);
}

function readCurrency(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value)) {
        throw new DossierShapeError(`${label} должна быть из трёх букв`);
    }

    return value.toUpperCase();
}

function readDate(value: unknown, label: string): Date | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value !== 'string') {
        throw new DossierShapeError(`${label} должна быть датой`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new DossierShapeError(`${label} должна быть датой`);
    }

    return date;
}

function assertExpiry(capturedAt: Date, expiresAt: Date, label: string): void {
    if (expiresAt.getTime() < capturedAt.getTime()) {
        throw new DossierShapeError(`${label}: срок раньше съёма`);
    }
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}
