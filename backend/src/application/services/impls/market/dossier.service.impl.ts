import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import {
    CreateDossierInput,
    DossierService,
    PublishDossierInput,
    ReviewDossierInput,
    ServeFromCacheInput,
    ServeFromCacheResult,
    UpdateDossierInput,
} from '../../contracts/market/dossier.service';
import {
    OPTIMAL_CARD_SERVICE,
    OptimalCardService,
} from '../../contracts/market/optimal-card.service';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { DossierMatchKind } from '../../../../domain/enums/dossier-match-kind.enum';
import { DossierReviewDecision } from '../../../../domain/enums/dossier-review-decision.enum';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { normalizeMatchText } from '../../../../domain/market/normalize-match-text';
import { SafeDossierReport, SafeDossierReportBody } from '../../../../domain/market/safe-dossier-report';
import { selectLiveDossier } from '../../../../domain/market/select-live-dossier';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { OptimalCardRepository } from '../../../../domain/repositories/market/optimal-card.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const POPULATE = [
    'category',
    'canonicalProduct',
    'quantityQuestion',
    'offer',
    'company',
    'storefront',
    'markedLiveByUser',
] as const;

/**
 * Утверждённое досье и live-кэш. Таблица optimal_card.
 * Клиенту отдаётся только public_report.
 */
@Injectable()
export class DossierServiceImpl implements DossierService {
    constructor(
        @Inject(OPTIMAL_CARD_SERVICE)
        private readonly cards: OptimalCardService,
        @Inject(REPOSITORY_TOKENS.OPTIMAL_CARD_REPOSITORY)
        private readonly dossiers: OptimalCardRepository,
        @Inject(REPOSITORY_TOKENS.INQUIRY_REPOSITORY)
        private readonly inquiries: InquiryRepository,
    ) {}

    async create(input: CreateDossierInput): Promise<OptimalCardEntity> {
        const card = await this.cards.create({
            ...input,
            isLive: false,
            expiresAt: null,
        });

        card.categoryReview = DossierReviewDecision.PENDING;
        card.offerReview = DossierReviewDecision.PENDING;
        card.supplierReview = DossierReviewDecision.PENDING;
        card.reviewNote = null;
        card.matchText = normalizeMatchText(input.matchText ?? input.nameRu ?? card.canonicalProduct.nameRu);
        card.publicReport = sanitizePublicReport(input.publicReport);
        card.revalidateAt = null;

        const em = this.dossiers.getEntityManager();

        em.persist(card);
        await em.flush();

        return this.require(card.id);
    }

    async getById(id: string): Promise<OptimalCardEntity> {
        return this.require(id);
    }

    async update(id: string, input: UpdateDossierInput): Promise<OptimalCardEntity> {
        await this.cards.update(id, {
            ...input,
            isLive: undefined,
            expiresAt: undefined,
        });

        const card = await this.require(id);

        if (input.matchText !== undefined) {
            card.matchText = normalizeMatchText(input.matchText ?? card.canonicalProduct.nameRu);
        }

        if (input.publicReport !== undefined) {
            card.publicReport = sanitizePublicReport(input.publicReport);
        }

        if (input.nameRu !== undefined && input.matchText === undefined) {
            card.matchText = normalizeMatchText(input.nameRu ?? card.canonicalProduct.nameRu);
        }

        const em = this.dossiers.getEntityManager();

        em.persist(card);
        await em.flush();

        return this.require(id);
    }

    async review(id: string, input: ReviewDossierInput): Promise<OptimalCardEntity> {
        const card = await this.require(id);
        const decision = input.decision;

        if (input.target === 'category') {
            card.categoryReview = decision;
        } else if (input.target === 'offer') {
            card.offerReview = decision;
        } else {
            card.supplierReview = decision;
        }

        if (input.note !== undefined) {
            card.reviewNote = emptyToNull(input.note);
        }

        if (
            decision === DossierReviewDecision.REJECTED &&
            card.isLive
        ) {
            card.isLive = false;
        }

        const em = this.dossiers.getEntityManager();

        em.persist(card);
        await em.flush();

        return this.require(id);
    }

    async publish(id: string, input: PublishDossierInput): Promise<OptimalCardEntity> {
        const card = await this.require(id);

        if (input.publicReport !== undefined) {
            card.publicReport = sanitizePublicReport(input.publicReport);
        }

        if (!card.publicReport) {
            throw new BadRequestAppException(AppErrors.dossier.reportMissing.message, {
                code: AppErrors.dossier.reportMissing.code,
            });
        }

        assertPublishable(card);

        const revalidateAt = resolveRevalidate(input.revalidateAt, new Date());

        card.revalidateAt = revalidateAt;
        card.expiresAt = revalidateAt;
        card.matchText = normalizeMatchText(card.matchText ?? card.canonicalProduct.nameRu);

        const em = this.dossiers.getEntityManager();

        em.persist(card);
        await em.flush();

        return this.cards.update(id, {
            adminUserId: input.adminUserId,
            isLive: true,
            expiresAt: revalidateAt,
        });
    }

    async getSafeReport(id: string, matchKind: 'exact' | 'similar' | null = null): Promise<SafeDossierReport> {
        const card = await this.require(id);
        const now = new Date();

        if (!card.isLive || !card.expiresAt || card.expiresAt.getTime() <= now.getTime()) {
            throw new NotFoundAppException(AppErrors.dossier.notLive.message, {
                code: AppErrors.dossier.notLive.code,
            });
        }

        return toSafeReport(card, matchKind);
    }

    async getInquiryReport(inquiryId: string): Promise<SafeDossierReport> {
        const inquiry = await this.inquiries.findOne(
            { id: inquiryId },
            { populate: ['optimalCard', 'optimalCard.canonicalProduct', 'optimalCard.category'] },
        );

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        const card = inquiry.optimalCard;

        if (
            !card ||
            inquiry.status !== InquiryStatus.SERVED_FROM_DATABASE ||
            !card.isLive ||
            !card.publicReport
        ) {
            throw new NotFoundAppException(AppErrors.dossier.inquiryReportMissing.message, {
                code: AppErrors.dossier.inquiryReportMissing.code,
            });
        }

        const full = await this.require(card.id);
        const kind = inferMatchKind(inquiry.rawText, full);

        return toSafeReport(full, kind);
    }

    async findLiveForRequest(input: ServeFromCacheInput): Promise<ServeFromCacheResult | null> {
        const live = await this.dossiers.find(
            { category: input.categoryId, isLive: true },
            { populate: [...POPULATE] },
        );
        const now = new Date();
        const answers = (input.answers ?? []).map((answer) => ({
            questionId: answer.questionId,
            answerType: answer.answerType as QuestionAnswerType,
            isRequired: answer.isRequired,
            valueText: answer.valueText,
            valueJson: answer.valueJson,
        }));
        const chosen = selectLiveDossier(
            answers,
            input.rawText,
            live.map((card) => ({
                id: card.id,
                quantityQuestionId: card.quantityQuestion.id,
                qtyMin: card.qtyMin,
                qtyMax: card.qtyMax,
                productAttributes: card.productAttributes ?? null,
                expiresAt: card.expiresAt ?? null,
                markedLiveAt: card.markedLiveAt ?? null,
                isLive: card.isLive,
                matchText: card.matchText ?? null,
                categoryReview: card.categoryReview,
                offerReview: card.offerReview,
                supplierReview: card.supplierReview,
                hasPublicReport: Boolean(card.publicReport),
            })),
            now,
        );

        if (!chosen) {
            return null;
        }

        const dossier = live.find((item) => item.id === chosen.id);

        return dossier ? { dossier, matchKind: chosen.kind } : null;
    }

    private async require(id: string): Promise<OptimalCardEntity> {
        const card = await this.dossiers.findOne({ id }, { populate: [...POPULATE] });

        if (!card) {
            throw new NotFoundAppException(AppErrors.dossier.notFound.message, {
                code: AppErrors.dossier.notFound.code,
            });
        }

        return card;
    }
}

function assertPublishable(card: OptimalCardEntity): void {
    const reviews = [card.categoryReview, card.offerReview, card.supplierReview];

    if (reviews.some((item) => item === DossierReviewDecision.REJECTED)) {
        throw new ConflictAppException(AppErrors.dossier.reviewRejected.message, {
            code: AppErrors.dossier.reviewRejected.code,
        });
    }

    if (reviews.some((item) => item !== DossierReviewDecision.APPROVED)) {
        throw new ConflictAppException(AppErrors.dossier.reviewsIncomplete.message, {
            code: AppErrors.dossier.reviewsIncomplete.code,
        });
    }
}

function resolveRevalidate(value: Date | null | undefined, now: Date): Date {
    if (value === undefined || value === null) {
        return new Date(now.getTime() + TTL_MS);
    }

    if (Number.isNaN(value.getTime()) || value.getTime() <= now.getTime()) {
        throw new BadRequestAppException(AppErrors.optimalCard.expiry.message, {
            code: AppErrors.optimalCard.expiry.code,
        });
    }

    return value;
}

function sanitizePublicReport(value: SafeDossierReportBody | null | undefined): SafeDossierReportBody | null {
    if (value === undefined || value === null) {
        return null;
    }

    // Контакты, сырую закупку и внутренние заметки в public_report не копируем.
    return {
        name: value.name,
        categoryLabel: value.categoryLabel,
        manufacturer: value.manufacturer ?? null,
        summary: value.summary ?? null,
        typicalPrice: value.typicalPrice,
        lowestCrediblePrice: value.lowestCrediblePrice,
        currency: value.currency,
        moqLabel: value.moqLabel,
        conditions: value.conditions,
        sources: value.sources ?? [],
        delivery: value.delivery ?? {
            available: false,
            demo: false,
            title: '2. Доставка',
        },
        disclaimer: value.disclaimer,
        photos: value.photos ?? [],
        specs: value.specs ?? [],
        procurement: value.procurement ?? null,
        market: value.market ?? null,
        breakdown: value.breakdown ?? null,
    };
}

function toSafeReport(card: OptimalCardEntity, matchKind: 'exact' | 'similar' | null): SafeDossierReport {
    const body = card.publicReport;

    if (!body) {
        throw new NotFoundAppException(AppErrors.dossier.reportMissing.message, {
            code: AppErrors.dossier.reportMissing.code,
        });
    }

    return {
        ...body,
        id: card.id,
        matchKind,
        revalidateAt: (card.revalidateAt ?? card.expiresAt)?.toISOString() ?? null,
    };
}

function inferMatchKind(rawText: string, card: OptimalCardEntity): 'exact' | 'similar' {
    const normalized = normalizeMatchText(rawText);
    const matchText = normalizeMatchText(card.matchText ?? card.canonicalProduct.nameRu);

    return normalized && normalized === matchText ? DossierMatchKind.EXACT : DossierMatchKind.SIMILAR;
}

function emptyToNull(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : null;
}
