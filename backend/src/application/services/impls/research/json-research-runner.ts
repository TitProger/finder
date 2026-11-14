import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { ResearchIngestResult, ResearchRunner } from '../../../ports/research-runner.port';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { CompanyEntity } from '../../../../domain/entities/catalog/company.entity';
import { StorefrontEntity } from '../../../../domain/entities/catalog/storefront.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { CompanyRepository } from '../../../../domain/repositories/catalog/company.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { StorefrontRepository } from '../../../../domain/repositories/catalog/storefront.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { MarketSnapshotRepository } from '../../../../domain/repositories/market/market-snapshot.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { DossierShapeError, ParsedDossier, parseDossier } from './parse-dossier';

/** Ручной импорт JSON. Провайдера поиска этот источник не называет. */
const JSON_IMPORT_SOURCE = 'json_import';

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
 * Приём JSON-досье.
 * Модель, площадки, браузер и Telegram отсюда не вызываются.
 * Оффер без url не пишется: причина попадает в research_run.failure_reason.
 * Прогон при этом успешен, заявка переходит в досье у админа.
 * Живая карточка этот вход не открывает: такой статус сюда не пускает.
 */
@Injectable()
export class JsonResearchRunner implements ResearchRunner {
    constructor(
        @Inject(REPOSITORY_TOKENS.INQUIRY_REPOSITORY)
        private readonly inquiries: InquiryRepository,
        @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
        private readonly companies: CompanyRepository,
        @Inject(REPOSITORY_TOKENS.STOREFRONT_REPOSITORY)
        private readonly storefronts: StorefrontRepository,
        @Inject(REPOSITORY_TOKENS.OFFER_REPOSITORY)
        private readonly offers: OfferRepository,
        @Inject(REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY)
        private readonly runs: ResearchRunRepository,
        @Inject(REPOSITORY_TOKENS.MARKET_SNAPSHOT_REPOSITORY)
        private readonly snapshots: MarketSnapshotRepository,
    ) {}

    async ingest(inquiryId: string, dossier: unknown): Promise<ResearchIngestResult> {
        const inquiry = await this.inquiries.findOne({ id: inquiryId });

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        this.assertOpen(inquiry);

        const now = new Date();
        const parsed = this.parse(dossier, now);
        const failureReason =
            parsed.discarded.length > 0 ? parsed.discarded.map((item) => item.reason).join('\n') : null;
        const run = this.runs.create({
            inquiry,
            source: JSON_IMPORT_SOURCE,
            status: ResearchRunStatus.SUCCEEDED,
            externalRunUrl: null,
            failureReason,
            startedAt: now,
            finishedAt: now,
        });
        const written = await this.persist(inquiry, run, parsed);

        return {
            researchRunId: run.id,
            inquiryId: inquiry.id,
            status: inquiry.status,
            companyIds: written.companyIds,
            storefrontIds: written.storefrontIds,
            offerIds: written.offerIds,
            marketSnapshotIds: written.marketSnapshotIds,
            discarded: parsed.discarded.map((item) => item.reason),
        };
    }

    private assertOpen(inquiry: InquiryEntity): void {
        if (inquiry.isPaused) {
            throw new BadRequestAppException(AppErrors.research.paused.message, {
                code: AppErrors.research.paused.code,
            });
        }

        if (!inquiry.category) {
            throw new BadRequestAppException(AppErrors.research.noCategory.message, {
                code: AppErrors.research.noCategory.code,
            });
        }

        if (!OPEN_STATUSES.has(inquiry.status)) {
            throw new BadRequestAppException(AppErrors.research.notOpen.message, {
                code: AppErrors.research.notOpen.code,
            });
        }
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

    private async persist(
        inquiry: InquiryEntity,
        run: ResearchRunEntity,
        parsed: ParsedDossier,
    ): Promise<{
        companyIds: string[];
        storefrontIds: string[];
        offerIds: string[];
        marketSnapshotIds: string[];
    }> {
        const em = this.inquiries.getEntityManager();

        try {
            return await em.transactional(async (tx) => {
                const companyIds: string[] = [];
                const storefrontIds: string[] = [];
                const offerIds: string[] = [];
                const marketSnapshotIds: string[] = [];
                const work = tx as UnitOfWork;
                const companyByRef = new Map<string, CompanyEntity>();
                const storefrontByRef = new Map<string, StorefrontEntity>();

                work.persist(run);

                for (const company of parsed.companies) {
                    const entity = this.companies.create({
                        legalNameZh: company.legalNameZh,
                        unifiedSocialCreditCode: company.unifiedSocialCreditCode,
                        registryStatus: company.registryStatus,
                        address: company.address,
                        businessScope: company.businessScope,
                        insuredEmployeeCount: company.insuredEmployeeCount,
                    });

                    work.persist(entity);
                    companyByRef.set(company.ref, entity);
                    companyIds.push(entity.id);

                    for (const shop of company.storefronts) {
                        const storefront = this.storefronts.create({
                            company: entity,
                            platformName: shop.platformName,
                            sellerExternalId: shop.sellerExternalId,
                            storefrontUrl: shop.storefrontUrl,
                            factoryLabels: shop.factoryLabels,
                            city: shop.city,
                        });

                        work.persist(storefront);
                        storefrontByRef.set(shop.ref, storefront);
                        storefrontIds.push(storefront.id);
                    }
                }

                for (const offer of parsed.offers) {
                    const entity = this.offers.create({
                        researchRun: run,
                        canonicalProduct: null,
                        company: offer.companyRef ? (companyByRef.get(offer.companyRef) ?? null) : null,
                        storefront: offer.storefrontRef ? (storefrontByRef.get(offer.storefrontRef) ?? null) : null,
                        categorySite: null,
                        sourceUrl: offer.sourceUrl,
                        price: offer.price,
                        currency: offer.currency,
                        volumeTier: offer.volumeTier,
                        moq: offer.moq,
                        quoteText: offer.quoteText,
                        supplierRole: offer.supplierRole,
                        capturedAt: offer.capturedAt,
                        expiresAt: offer.expiresAt,
                    });

                    work.persist(entity);
                    offerIds.push(entity.id);
                }

                for (const snapshot of parsed.snapshots) {
                    const entity = this.snapshots.create({
                        researchRun: run,
                        inquiry,
                        canonicalProduct: null,
                        layer: snapshot.layer,
                        source: snapshot.source,
                        medianPrice: snapshot.medianPrice,
                        currency: snapshot.currency,
                        spreadLow: snapshot.spreadLow,
                        spreadHigh: snapshot.spreadHigh,
                        samplePoints: snapshot.samplePoints,
                        capturedAt: snapshot.capturedAt,
                        expiresAt: snapshot.expiresAt,
                    });

                    work.persist(entity);
                    marketSnapshotIds.push(entity.id);
                }

                inquiry.status = InquiryStatus.DOSSIER_WITH_ADMIN;
                work.persist(inquiry);
                await work.flush();

                return { companyIds, storefrontIds, offerIds, marketSnapshotIds };
            });
        } catch (error) {
            if (error instanceof UniqueConstraintViolationException) {
                throw new ConflictAppException(AppErrors.research.duplicate.message, {
                    code: AppErrors.research.duplicate.code,
                });
            }

            throw error;
        }
    }
}
