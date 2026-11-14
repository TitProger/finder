import { createHash } from 'crypto';

import { CompanyRegistryStatus } from '../../../../domain/enums/company-registry-status.enum';
import { MarketPriceLayer } from '../../../../domain/enums/market-price-layer.enum';
import { SupplierRole } from '../../../../domain/enums/supplier-role.enum';
import { OFFER_TTL_MS, addTtl } from '../../../../domain/research/dossier-clock';
import { partitionOffers } from '../../../../domain/research/partition-offers';

const DOSSIER_STATUSES = ['complete', 'partial', 'failed'] as const;
const SITE_STATUSES = ['ok', 'captcha', 'login_required', 'blocked', 'empty', 'skipped'] as const;
const REGISTRY = {
    active: CompanyRegistryStatus.ACTIVE,
    revoked: CompanyRegistryStatus.REVOKED,
    unknown: CompanyRegistryStatus.UNKNOWN,
} as const;
const ROLES = new Set<string>(Object.values(SupplierRole));
const LAYERS = new Set<string>(Object.values(MarketPriceLayer));
const UNITS = new Set(['piece', 'set', 'car', 'm', 'm2', 't']);
const CURRENCIES = new Set(['CNY', 'USD', 'RUB']);
const CHANNELS = new Set(['phone', 'email', 'wechat', 'site']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DossierShapeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DossierShapeError';
    }
}

export type DossierStatus = (typeof DOSSIER_STATUSES)[number];

export type ParsedContact = {
    channel: string;
    value: string;
    sourceUrl: string;
};

export type ParsedCompany = {
    index: number;
    legalNameZh: string;
    name: string | null;
    uscc: string | null;
    registryStatus: CompanyRegistryStatus;
    businessScope: string | null;
    insuredEmployeeCount: number | null;
    role: SupplierRole;
    roleEvidence: string[] | null;
    contacts: ParsedContact[];
};

export type ParsedOffer = {
    index: number;
    companyIndex: number | null;
    site: string | null;
    sourceUrl: string;
    quote: string;
    title: string | null;
    price: string | null;
    currency: string | null;
    unit: string | null;
    qtyFrom: string | null;
    moq: string | null;
    layer: MarketPriceLayer | null;
    capturedAt: Date;
    expiresAt: Date;
    supplierRole: SupplierRole;
};

export type DiscardedItem = {
    path: string;
    reason: string;
};

export type ParsedDossier = {
    inquiryId: string;
    runId: string;
    status: DossierStatus;
    category: string;
    pack: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    sites: Record<string, unknown>[];
    companies: ParsedCompany[];
    offers: ParsedOffer[];
    fx: Record<string, unknown> | null;
    summaryRu: string | null;
    discarded: DiscardedItem[];
};

export function payloadSha256(raw: unknown): string {
    return createHash('sha256').update(stableStringify(raw)).digest('hex');
}

export function parseDossier(raw: unknown, now: Date): ParsedDossier {
    const body = asRecord(raw, 'Досье');
    const inquiryId = readUuid(body.inquiry_id, 'inquiry_id');
    const runId = readUuid(body.run_id, 'run_id');
    const status = readStatus(body.status);
    const category = readRequiredText(body.category, 'category', 64);
    const discarded: DiscardedItem[] = [];
    const companies = parseCompanies(readRequiredArray(body.companies, 'companies'), discarded);
    const partitioned = partitionOffers(readRequiredArray(body.offers, 'offers'));
    const offers = partitioned.kept.flatMap((offer) => {
        const parsed = parseOffer(offer, companies.length, now, discarded);

        return parsed ? [parsed] : [];
    });

    discarded.push(...partitioned.discarded.map((item) => ({ path: item.path, reason: item.reason })));

    return {
        inquiryId,
        runId,
        status,
        category,
        pack: readOptionalText(body.pack, 'pack', 64),
        startedAt: readDate(body.started_at, 'started_at'),
        finishedAt: readDate(body.finished_at, 'finished_at'),
        sites: parseSites(readRequiredArray(body.sites, 'sites')),
        companies,
        offers,
        fx: parseFx(body.fx),
        summaryRu: readOptionalText(body.summary_ru, 'summary_ru', 8000),
        discarded,
    };
}

function parseCompanies(items: readonly unknown[], discarded: DiscardedItem[]): ParsedCompany[] {
    return items.map((item, index) => {
        const label = `companies[${index}]`;
        const body = asRecord(item, label);
        const nameCn = readOptionalText(body.name_cn, `${label}.name_cn`, 512);
        const name = readOptionalText(body.name, `${label}.name`, 512);

        if (!nameCn && !name) {
            throw new DossierShapeError(`${label}: нет имени`);
        }

        const uscc = readUscc(body.uscc, label);
        const contacts = parseContacts(body.contacts, index, discarded);

        return {
            index,
            legalNameZh: nameCn ?? name!,
            name,
            uscc,
            registryStatus: readRegistry(body.registry_status, label),
            businessScope: readOptionalText(body.scope, `${label}.scope`, 8000),
            insuredEmployeeCount: readCount(body.insured_count, label),
            role: readRole(body.role, label),
            roleEvidence: readEvidence(body.role_evidence, label),
            contacts,
        };
    });
}

function parseContacts(value: unknown, companyIndex: number, discarded: DiscardedItem[]): ParsedContact[] {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new DossierShapeError(`companies[${companyIndex}].contacts должен быть массивом`);
    }

    const contacts: ParsedContact[] = [];

    value.forEach((item, index) => {
        const path = `companies[${companyIndex}].contacts[${index}]`;
        const body = asRecord(item, path);
        const channel = readOptionalText(body.channel, `${path}.channel`, 16);
        const contactValue = readOptionalText(body.value, `${path}.value`, 8000);
        const sourceUrl = readOptionalText(body.source_url, `${path}.source_url`, 2048);

        if (!channel || !CHANNELS.has(channel) || !contactValue) {
            discarded.push({ path, reason: 'контакт без канала или значения' });

            return;
        }

        if (!sourceUrl || !isHttpUrl(sourceUrl)) {
            discarded.push({ path, reason: 'нет source_url' });

            return;
        }

        contacts.push({ channel, value: contactValue, sourceUrl });
    });

    return contacts;
}

function parseOffer(
    kept: { index: number; sourceUrl: string; quote: string; body: Record<string, unknown> },
    companyCount: number,
    now: Date,
    discarded: DiscardedItem[],
): ParsedOffer | null {
    const path = `offers[${kept.index}]`;
    const body = kept.body;
    const layer = readLayer(body.layer);
    const currency = readCurrency(body.currency);
    const unit = readUnit(body.unit);

    if (layer.invalid || currency.invalid || unit.invalid) {
        discarded.push({
            path,
            reason: layer.invalid || currency.invalid || unit.invalid || 'поле оффера не из списка',
        });

        return null;
    }

    let companyIndex: number | null = null;

    if (body.company_ref !== undefined && body.company_ref !== null) {
        if (typeof body.company_ref !== 'number' || !Number.isInteger(body.company_ref)) {
            discarded.push({ path, reason: 'company_ref вне массива' });
        } else if (body.company_ref < 0 || body.company_ref >= companyCount) {
            discarded.push({ path, reason: 'company_ref вне массива' });
        } else {
            companyIndex = body.company_ref;
        }
    }

    const capturedAt = readDate(body.captured_at, `${path}.captured_at`) ?? now;

    return {
        index: kept.index,
        companyIndex,
        site: readOptionalText(body.site, `${path}.site`, 128),
        sourceUrl: kept.sourceUrl,
        quote: kept.quote,
        title: readOptionalText(body.title, `${path}.title`, 8000),
        price: readDecimal(body.price, `${path}.price`),
        currency: currency.value,
        unit: unit.value,
        qtyFrom: readDecimal(body.qty_from, `${path}.qty_from`),
        moq: readDecimal(body.moq, `${path}.moq`),
        layer: layer.value,
        capturedAt,
        expiresAt: addTtl(capturedAt, OFFER_TTL_MS),
        supplierRole: SupplierRole.UNVERIFIED,
    };
}

function parseSites(items: readonly unknown[]): Record<string, unknown>[] {
    return items.map((item, index) => {
        const label = `sites[${index}]`;
        const body = asRecord(item, label);
        const site = readRequiredText(body.site, `${label}.site`, 128);
        const status = readOptionalText(body.status, `${label}.status`, 32);

        if (!status || !isOneOf(status, SITE_STATUSES)) {
            throw new DossierShapeError(`${label}.status не из списка`);
        }

        return {
            ...body,
            site,
            status,
        };
    });
}

function parseFx(value: unknown): Record<string, unknown> | null {
    if (value === undefined || value === null) {
        return null;
    }

    return asRecord(value, 'fx');
}

function readStatus(value: unknown): DossierStatus {
    if (!isOneOf(value, DOSSIER_STATUSES)) {
        throw new DossierShapeError('status не из списка');
    }

    return value;
}

function readRegistry(value: unknown, label: string): CompanyRegistryStatus {
    if (value === undefined || value === null) {
        return CompanyRegistryStatus.UNKNOWN;
    }

    if (typeof value !== 'string' || !(value in REGISTRY)) {
        throw new DossierShapeError(`${label}.registry_status не из списка`);
    }

    return REGISTRY[value as keyof typeof REGISTRY];
}

function readRole(value: unknown, label: string): SupplierRole {
    if (value === undefined || value === null) {
        return SupplierRole.UNVERIFIED;
    }

    if (typeof value !== 'string' || !ROLES.has(value)) {
        throw new DossierShapeError(`${label}.role не из списка`);
    }

    return value as SupplierRole;
}

function readLayer(value: unknown): { value: MarketPriceLayer | null; invalid: string | null } {
    if (value === undefined || value === null) {
        return { value: null, invalid: null };
    }

    if (typeof value !== 'string' || !LAYERS.has(value)) {
        return { value: null, invalid: 'layer не из списка' };
    }

    return { value: value as MarketPriceLayer, invalid: null };
}

function readCurrency(value: unknown): { value: string | null; invalid: string | null } {
    if (value === undefined || value === null || value === '') {
        return { value: null, invalid: null };
    }

    if (typeof value !== 'string' || !CURRENCIES.has(value.toUpperCase())) {
        return { value: null, invalid: 'currency не из списка' };
    }

    return { value: value.toUpperCase(), invalid: null };
}

function readUnit(value: unknown): { value: string | null; invalid: string | null } {
    if (value === undefined || value === null || value === '') {
        return { value: null, invalid: null };
    }

    if (typeof value !== 'string' || !UNITS.has(value)) {
        return { value: null, invalid: 'unit не из списка' };
    }

    return { value, invalid: null };
}

function readEvidence(value: unknown, label: string): string[] | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (!Array.isArray(value)) {
        throw new DossierShapeError(`${label}.role_evidence должен быть массивом строк`);
    }

    const evidence: string[] = [];

    for (const item of value) {
        if (typeof item !== 'string') {
            throw new DossierShapeError(`${label}.role_evidence должен быть массивом строк`);
        }

        evidence.push(item);
    }

    return evidence;
}

function readUscc(value: unknown, label: string): string | null {
    const text = readOptionalText(value, `${label}.uscc`, 32);

    if (!text) {
        return null;
    }

    const normalized = text.toUpperCase();

    if (!/^[0-9A-Z]{18}$/.test(normalized)) {
        throw new DossierShapeError(`${label}.uscc должен быть из 18 символов`);
    }

    return normalized;
}

function readUuid(value: unknown, label: string): string {
    const text = readRequiredText(value, label, 36);

    if (!UUID.test(text)) {
        throw new DossierShapeError(`${label} должен быть uuid`);
    }

    return text.toLowerCase();
}

function readRequiredArray(value: unknown, label: string): unknown[] {
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

function readCount(value: unknown, label: string): number | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new DossierShapeError(`${label}.insured_count должно быть целым от нуля`);
    }

    return value;
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

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);

        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const keys = Object.keys(record).sort();

        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
    }

    return JSON.stringify(value) ?? 'null';
}
