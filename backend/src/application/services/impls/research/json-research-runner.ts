import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { ResearchIngestResult, ResearchRunner } from '../../../ports/research-runner.port';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { UnprocessableAppException } from '../../../../common/exceptions/unprocessable.exception';
import { CompanyEntity } from '../../../../domain/entities/catalog/company.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ResearchRunEntity, StoredIngestResult } from '../../../../domain/entities/market/research-run.entity';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { SupplierRole } from '../../../../domain/enums/supplier-role.enum';
import { CompanyContactRepository } from '../../../../domain/repositories/catalog/company-contact.repository';
import { CompanyRepository } from '../../../../domain/repositories/catalog/company.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { DossierShapeError, ParsedCompany, ParsedDossier, parseDossier, payloadSha256 } from './parse-dossier';

const JSON_IMPORT_SOURCE = 'research_ingest';

const OPEN_STATUSES = new Set<InquiryStatus>([
    InquiryStatus.COLLECTING_ANSWERS,
    InquiryStatus.RESEARCHING,
    InquiryStatus.DOSSIER_WITH_ADMIN,
]);

type UnitOfWork = {
    persist(entity: object): unknown;
    flush(): Promise<void>;
};

/**
 * Приём досье по схеме ресерча.
 * Повтор того же run_id с тем же телом ничего не пишет.
 * Компания с уже известным USCC обновляется.
 * Цены в ответ не попадают.
 */
@Injectable()
export class JsonResearchRunner implements ResearchRunner {
    constructor(
        @Inject(REPOSITORY_TOKENS.INQUIRY_REPOSITORY)
        private readonly inquiries: InquiryRepository,
        @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
        private readonly companies: CompanyRepository,
        @Inject(REPOSITORY_TOKENS.COMPANY_CONTACT_REPOSITORY)
        private readonly contacts: CompanyContactRepository,
        @Inject(REPOSITORY_TOKENS.OFFER_REPOSITORY)
        private readonly offers: OfferRepository,
        @Inject(REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY)
        private readonly runs: ResearchRunRepository,
    ) {}

    async ingest(dossier: unknown): Promise<ResearchIngestResult> {
        const now = new Date();
        const parsed = this.parse(dossier, now);
        const hash = payloadSha256(dossier);
        const inquiry = await this.inquiries.findOne({ id: parsed.inquiryId }, { populate: ['category'] });

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        const existingRun = await this.runs.findOne({ runId: parsed.runId });

        if (existingRun?.payloadSha256) {
            if (existingRun.payloadSha256 === hash) {
                return this.duplicateOf(existingRun, inquiry);
            }

            throw new ConflictAppException(AppErrors.research.runReused.message, {
                code: AppErrors.research.runReused.code,
            });
        }

        this.assertAcceptable(inquiry, parsed.category);

        const knownCompanies = await this.loadCompanies(parsed.companies);
        const knownContacts = await this.loadContacts(knownCompanies);
        const run = this.prepareRun(existingRun, inquiry, parsed, dossier, hash, now);
        const stored = await this.persist(inquiry, run, parsed, knownCompanies, knownContacts, now);

        return this.resultOf(run, inquiry, stored, false);
    }

    private parse(dossier: unknown, now: Date): ParsedDossier {
        try {
            return parseDossier(dossier, now);
        } catch (error) {
            if (error instanceof DossierShapeError) {
                throw new BadRequestAppException(error.message, {
                    code: AppErrors.research.dossierShape.code,
                });
            }

            throw error;
        }
    }

    private assertAcceptable(inquiry: InquiryEntity, categoryCode: string): void {
        if (!inquiry.category) {
            throw new BadRequestAppException(AppErrors.research.noCategory.message, {
                code: AppErrors.research.noCategory.code,
            });
        }

        if (!OPEN_STATUSES.has(inquiry.status)) {
            throw new ConflictAppException(AppErrors.research.notOpen.message, {
                code: AppErrors.research.notOpen.code,
            });
        }

        const actual = inquiry.category.code ?? null;

        if (!actual || actual !== categoryCode) {
            throw new UnprocessableAppException(AppErrors.research.categoryMismatch.message, {
                code: AppErrors.research.categoryMismatch.code,
            });
        }
    }

    private async loadCompanies(companies: readonly ParsedCompany[]): Promise<Map<string, CompanyEntity>> {
        const found = new Map<string, CompanyEntity>();

        for (const company of companies) {
            if (!company.uscc || found.has(company.uscc)) {
                continue;
            }

            const existing = await this.companies.findOne({ unifiedSocialCreditCode: company.uscc });

            if (existing) {
                found.set(company.uscc, existing);
            }
        }

        return found;
    }

    private async loadContacts(companies: Map<string, CompanyEntity>): Promise<Set<string>> {
        const keys = new Set<string>();

        for (const company of companies.values()) {
            const rows = await this.contacts.find({ company: company.id });

            for (const row of rows) {
                keys.add(contactKey(company.id, row.channel, row.value, row.sourceUrl));
            }
        }

        return keys;
    }

    private prepareRun(
        existing: ResearchRunEntity | null,
        inquiry: InquiryEntity,
        parsed: ParsedDossier,
        dossier: unknown,
        hash: string,
        now: Date,
    ): ResearchRunEntity {
        const run =
            existing ??
            this.runs.create({
                inquiry,
                source: JSON_IMPORT_SOURCE,
                externalRunUrl: null,
            });

        run.inquiry = inquiry;
        run.runId = parsed.runId;
        run.source = JSON_IMPORT_SOURCE;
        run.status = parsed.status === 'failed' ? ResearchRunStatus.FAILED : ResearchRunStatus.SUCCEEDED;
        run.dossierStatus = parsed.status;
        run.sites = parsed.sites;
        run.fx = parsed.fx;
        run.summaryRu = parsed.summaryRu;
        run.rawPayload = dossier;
        run.payloadSha256 = hash;
        run.discarded = parsed.discarded;
        run.startedAt = parsed.startedAt ?? existing?.startedAt ?? now;
        run.finishedAt = parsed.finishedAt ?? now;
        run.failureReason = parsed.status === 'failed' ? (parsed.summaryRu ?? 'Досье со статусом failed') : null;

        return run;
    }

    private async persist(
        inquiry: InquiryEntity,
        run: ResearchRunEntity,
        parsed: ParsedDossier,
        knownCompanies: Map<string, CompanyEntity>,
        knownContacts: Set<string>,
        now: Date,
    ): Promise<StoredIngestResult> {
        const em = this.inquiries.getEntityManager();

        return em.transactional(async (tx) => {
            const work = tx as UnitOfWork;
            const companyByIndex = new Map<number, CompanyEntity>();
            const touchedCompanies = new Set<string>();
            let contactCount = 0;

            work.persist(run);

            for (const company of parsed.companies) {
                const entity = this.upsertCompany(company, knownCompanies);

                work.persist(entity);
                companyByIndex.set(company.index, entity);
                touchedCompanies.add(entity.id);

                for (const contact of company.contacts) {
                    const key = contactKey(entity.id, contact.channel, contact.value, contact.sourceUrl);

                    if (knownContacts.has(key)) {
                        continue;
                    }

                    knownContacts.add(key);

                    const row = this.contacts.create({
                        company: entity,
                        channel: contact.channel,
                        value: contact.value,
                        sourceUrl: contact.sourceUrl,
                        capturedAt: now,
                    });

                    work.persist(row);
                    contactCount += 1;
                }
            }

            for (const offer of parsed.offers) {
                const company = offer.companyIndex === null ? null : (companyByIndex.get(offer.companyIndex) ?? null);
                const entity = this.offers.create({
                    researchRun: run,
                    canonicalProduct: null,
                    company,
                    storefront: null,
                    categorySite: null,
                    sourceUrl: offer.sourceUrl,
                    title: offer.title,
                    site: offer.site,
                    layer: offer.layer,
                    unit: offer.unit,
                    qtyFrom: offer.qtyFrom,
                    price: offer.price,
                    currency: offer.currency,
                    moq: offer.moq,
                    quoteText: offer.quote,
                    supplierRole: company?.role ?? SupplierRole.UNVERIFIED,
                    capturedAt: offer.capturedAt,
                    expiresAt: offer.expiresAt,
                });

                work.persist(entity);
            }

            inquiry.status = InquiryStatus.DOSSIER_WITH_ADMIN;
            work.persist(inquiry);

            const stored: StoredIngestResult = {
                counts: {
                    companies: touchedCompanies.size,
                    offers: parsed.offers.length,
                    contacts: contactCount,
                },
                discarded: parsed.discarded,
            };

            run.ingestResult = stored;
            await work.flush();

            return stored;
        });
    }

    private upsertCompany(company: ParsedCompany, known: Map<string, CompanyEntity>): CompanyEntity {
        const existing = company.uscc ? known.get(company.uscc) : undefined;
        const entity =
            existing ??
            this.companies.create({
                legalNameZh: company.legalNameZh,
                unifiedSocialCreditCode: company.uscc,
            });

        entity.legalNameZh = company.legalNameZh;
        entity.name = company.name;
        entity.unifiedSocialCreditCode = company.uscc;
        entity.registryStatus = company.registryStatus;
        entity.businessScope = company.businessScope;
        entity.insuredEmployeeCount = company.insuredEmployeeCount;
        entity.role = company.role;
        entity.roleEvidence = company.roleEvidence;

        if (company.uscc) {
            known.set(company.uscc, entity);
        }

        return entity;
    }

    private duplicateOf(run: ResearchRunEntity, inquiry: InquiryEntity): ResearchIngestResult {
        const stored = run.ingestResult ?? {
            counts: { companies: 0, offers: 0, contacts: 0 },
            discarded: run.discarded ?? [],
        };

        return this.resultOf(run, inquiry, stored, true);
    }

    private resultOf(
        run: ResearchRunEntity,
        inquiry: InquiryEntity,
        stored: StoredIngestResult,
        duplicate: boolean,
    ): ResearchIngestResult {
        return {
            researchRunId: run.id,
            inquiryId: inquiry.id,
            inquiryStatus: inquiry.status,
            duplicate,
            counts: stored.counts,
            discarded: stored.discarded,
        };
    }
}

function contactKey(companyId: string, channel: string, value: string, sourceUrl: string): string {
    return `${companyId}\0${channel}\0${value}\0${sourceUrl}`;
}
