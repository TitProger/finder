import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import {
    CreateOptimalCardInput,
    OptimalCardService,
    UpdateOptimalCardInput,
} from '../../contracts/market/optimal-card.service';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { ForbiddenAppException } from '../../../../common/exceptions/forbidden.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { UnauthorizedAppException } from '../../../../common/exceptions/unauthorized.exception';
import { CanonicalProductEntity } from '../../../../domain/entities/catalog/canonical-product.entity';
import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { canonicalAttributeValue } from '../../../../domain/market/attribute-value';
import { decimalString, sameDecimal } from '../../../../domain/market/decimal-qty';
import { CanonicalProductRepository } from '../../../../domain/repositories/catalog/canonical-product.repository';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { CategoryQuestionRepository } from '../../../../domain/repositories/category/category-question.repository';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { OptimalCardRepository } from '../../../../domain/repositories/market/optimal-card.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';

const CARD_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CARD_POPULATE = [
    'category',
    'canonicalProduct',
    'quantityQuestion',
    'offer',
    'company',
    'storefront',
    'markedLiveByUser',
] as const;

/**
 * Оптимальная карточка админа.
 * Живой может быть один ряд на товар и диапазон количества. Предыдущая строка остаётся.
 * Парсеры и research_run отсюда не вызываются.
 */
@Injectable()
export class OptimalCardServiceImpl implements OptimalCardService {
    constructor(
        @Inject(REPOSITORY_TOKENS.OPTIMAL_CARD_REPOSITORY)
        private readonly cards: OptimalCardRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_REPOSITORY)
        private readonly categories: CategoryRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_QUESTION_REPOSITORY)
        private readonly questions: CategoryQuestionRepository,
        @Inject(REPOSITORY_TOKENS.CANONICAL_PRODUCT_REPOSITORY)
        private readonly products: CanonicalProductRepository,
        @Inject(REPOSITORY_TOKENS.OFFER_REPOSITORY)
        private readonly offers: OfferRepository,
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
    ) {}

    async create(input: CreateOptimalCardInput): Promise<OptimalCardEntity> {
        const admin = await this.requireAdmin(input.adminUserId);
        const category = await this.requireCategory(input.categoryId);
        const offer = await this.loadOffer(input.offerId);
        const quantityQuestion = await this.requireQuantityQuestion(category.id, input.quantityQuestionId);
        const questions = await this.questions.find({ category: category.id });

        this.requireAttributes(questions, quantityQuestion.id, input.productAttributes);

        const qty = requireRange(input.qtyMin, input.qtyMax);
        const product = await this.resolveProduct(category, offer, input);
        const card = this.cards.create({
            category,
            canonicalProduct: product,
            qtyMin: qty.min,
            qtyMax: qty.max,
            quantityQuestion,
            isLive: false,
            offer: offer ?? null,
            company: offer?.company ?? null,
            storefront: offer?.storefront ?? null,
            price: resolvePrice(input.price, offer?.price ?? null),
            currency: resolveCurrency(input.currency, offer?.currency ?? null),
            contactValue: emptyToNull(input.contactValue),
            contactChannel: input.contactChannel ?? null,
            contactUrl: input.contactAdminEntered ? null : picked(input.contactUrl, offer?.sourceUrl ?? null),
            contactAdminEntered: input.contactAdminEntered ?? false,
            contactEnteredAt: null,
            productAttributes: input.productAttributes,
            reasonNote: emptyToNull(input.reasonNote),
            markedLiveByUser: null,
            markedLiveAt: null,
            expiresAt: resolveExpiry(input.expiresAt, new Date()),
        });

        normalizeContact(card, input.contactAdminEntered === true);
        await this.persistCard(card, admin, input.isLive ?? false, false, true);

        return card;
    }

    async getById(id: string): Promise<OptimalCardEntity> {
        return this.requireCard(id);
    }

    async update(id: string, input: UpdateOptimalCardInput): Promise<OptimalCardEntity> {
        const admin = await this.requireAdmin(input.adminUserId);
        const card = await this.requireCard(id);
        const wasLive = card.isLive;
        const questions = await this.questions.find({ category: card.category.id });
        const quantityQuestion = input.quantityQuestionId
            ? await this.requireQuantityQuestion(card.category.id, input.quantityQuestionId)
            : card.quantityQuestion;
        const attributes = input.productAttributes ?? asRecord(card.productAttributes ?? {});

        this.requireAttributes(questions, quantityQuestion.id, attributes);

        const qty = requireRange(
            input.qtyMin !== undefined ? input.qtyMin : Number(card.qtyMin),
            input.qtyMax !== undefined ? input.qtyMax : Number(card.qtyMax),
        );
        const nextProduct = input.canonicalProductId
            ? await this.requireProduct(card.category.id, input.canonicalProductId)
            : card.canonicalProduct;

        if (input.nameRu !== undefined || input.nameZh !== undefined) {
            this.rename(nextProduct, input.nameRu, input.nameZh);
        }

        const slotChanges =
            nextProduct.id !== card.canonicalProduct.id ||
            !sameDecimal(qty.min, card.qtyMin) ||
            !sameDecimal(qty.max, card.qtyMax);

        card.canonicalProduct = nextProduct;
        card.qtyMin = qty.min;
        card.qtyMax = qty.max;
        card.quantityQuestion = quantityQuestion;

        if (input.productAttributes) {
            card.productAttributes = input.productAttributes;
        }

        if (input.price !== undefined) {
            card.price = resolvePrice(input.price, null);
        }

        if (input.currency !== undefined) {
            card.currency = resolveCurrency(input.currency, null);
        }

        if (input.contactValue !== undefined) {
            card.contactValue = emptyToNull(input.contactValue);
        }

        if (input.contactChannel !== undefined) {
            card.contactChannel = input.contactChannel;
        }

        if (input.contactUrl !== undefined) {
            card.contactUrl = emptyToNull(input.contactUrl);
        }

        if (input.contactAdminEntered !== undefined) {
            card.contactAdminEntered = input.contactAdminEntered;
        }

        if (input.reasonNote !== undefined) {
            card.reasonNote = emptyToNull(input.reasonNote);
        }

        if (input.expiresAt !== undefined) {
            card.expiresAt = resolveExpiry(input.expiresAt, new Date());
        }

        if (
            input.contactValue !== undefined ||
            input.contactUrl !== undefined ||
            input.contactAdminEntered !== undefined
        ) {
            normalizeContact(card, input.contactAdminEntered === true);
        }

        await this.persistCard(card, admin, input.isLive !== undefined ? input.isLive : wasLive, wasLive, slotChanges);

        return card;
    }

    private async resolveProduct(
        category: CategoryEntity,
        offer: OfferEntity | null,
        input: CreateOptimalCardInput,
    ): Promise<CanonicalProductEntity> {
        if (input.canonicalProductId) {
            const product = await this.requireProduct(category.id, input.canonicalProductId);

            this.rename(product, input.nameRu, input.nameZh);

            return product;
        }

        if (offer?.canonicalProduct) {
            if (offer.canonicalProduct.category.id !== category.id) {
                throw new ConflictAppException(AppErrors.optimalCard.productCategory.message, {
                    code: AppErrors.optimalCard.productCategory.code,
                });
            }

            this.rename(offer.canonicalProduct, input.nameRu, input.nameZh);

            return offer.canonicalProduct;
        }

        const nameRu = input.nameRu?.trim() ?? '';

        if (!nameRu) {
            throw new BadRequestAppException(AppErrors.optimalCard.productNameRequired.message, {
                code: AppErrors.optimalCard.productNameRequired.code,
            });
        }

        return this.products.create({
            category,
            nameRu,
            nameZh: emptyToNull(input.nameZh),
            attributes: input.productAttributes,
            embedding: null,
        });
    }

    private rename(product: CanonicalProductEntity, nameRu?: string | null, nameZh?: string | null): void {
        if (nameRu !== undefined && nameRu !== null) {
            const trimmed = nameRu.trim();

            if (!trimmed) {
                throw new BadRequestAppException(AppErrors.optimalCard.productNameRequired.message, {
                    code: AppErrors.optimalCard.productNameRequired.code,
                });
            }

            product.nameRu = trimmed;
        }

        if (nameZh !== undefined) {
            product.nameZh = emptyToNull(nameZh);
        }
    }

    private requireAttributes(
        questions: CategoryQuestionEntity[],
        quantityQuestionId: string,
        raw: Record<string, unknown>,
    ): void {
        const byId = new Map(questions.map((question) => [question.id, question]));

        for (const [questionId, value] of Object.entries(raw)) {
            const question = byId.get(questionId);

            if (questionId === quantityQuestionId || !question || !question.isRequired) {
                throw new BadRequestAppException(AppErrors.optimalCard.attributes.message, {
                    code: AppErrors.optimalCard.attributes.code,
                });
            }

            if (canonicalAttributeValue(question.answerType, value) === null) {
                throw new BadRequestAppException(AppErrors.optimalCard.attributes.message, {
                    code: AppErrors.optimalCard.attributes.code,
                });
            }
        }
    }

    private async persistCard(
        card: OptimalCardEntity,
        admin: AppUserEntity,
        nextLive: boolean,
        wasLive: boolean,
        slotChanges: boolean,
    ): Promise<void> {
        const em = this.cards.getEntityManager();

        try {
            await em.transactional(async (tx) => {
                tx.persist(card.canonicalProduct);
                tx.persist(card);

                if (!nextLive) {
                    card.isLive = false;
                    await tx.flush();

                    return;
                }

                if (wasLive && !slotChanges) {
                    card.isLive = true;
                    await tx.flush();

                    return;
                }

                card.isLive = false;
                await tx.flush();

                const others = await this.cards.find({
                    canonicalProduct: card.canonicalProduct.id,
                    isLive: true,
                });

                for (const other of others) {
                    if (other.id === card.id) {
                        continue;
                    }

                    if (sameDecimal(other.qtyMin, card.qtyMin) && sameDecimal(other.qtyMax, card.qtyMax)) {
                        other.isLive = false;
                    }
                }

                await tx.flush();
                card.isLive = true;
                card.markedLiveByUser = admin;
                card.markedLiveAt = new Date();
                await tx.flush();
            });
        } catch (error) {
            if (error instanceof UniqueConstraintViolationException) {
                throw new ConflictAppException(AppErrors.optimalCard.liveConflict.message, {
                    code: AppErrors.optimalCard.liveConflict.code,
                });
            }

            throw error;
        }
    }

    private async requireCard(id: string): Promise<OptimalCardEntity> {
        const card = await this.cards.findOne({ id }, { populate: [...CARD_POPULATE] });

        if (!card) {
            throw new NotFoundAppException(AppErrors.optimalCard.notFound.message, {
                code: AppErrors.optimalCard.notFound.code,
            });
        }

        return card;
    }

    private async requireCategory(id: string): Promise<CategoryEntity> {
        const category = await this.categories.findOne({ id });

        if (!category) {
            throw new NotFoundAppException(AppErrors.category.notFound.message, {
                code: AppErrors.category.notFound.code,
            });
        }

        return category;
    }

    private async requireProduct(categoryId: string, productId: string): Promise<CanonicalProductEntity> {
        const product = await this.products.findOne({ id: productId }, { populate: ['category'] });

        if (!product) {
            throw new NotFoundAppException(AppErrors.optimalCard.productNotFound.message, {
                code: AppErrors.optimalCard.productNotFound.code,
            });
        }

        if (product.category.id !== categoryId) {
            throw new ConflictAppException(AppErrors.optimalCard.productCategory.message, {
                code: AppErrors.optimalCard.productCategory.code,
            });
        }

        return product;
    }

    private async requireQuantityQuestion(categoryId: string, questionId: string): Promise<CategoryQuestionEntity> {
        const question = await this.questions.findOne({ id: questionId }, { populate: ['category'] });

        if (!question) {
            throw new NotFoundAppException(AppErrors.category.questionNotFound.message, {
                code: AppErrors.category.questionNotFound.code,
            });
        }

        if (
            question.category.id !== categoryId ||
            !question.isRequired ||
            question.answerType !== QuestionAnswerType.NUMBER
        ) {
            throw new BadRequestAppException(AppErrors.optimalCard.quantityQuestion.message, {
                code: AppErrors.optimalCard.quantityQuestion.code,
            });
        }

        return question;
    }

    private async loadOffer(offerId: string | null | undefined): Promise<OfferEntity | null> {
        if (!offerId) {
            return null;
        }

        const offer = await this.offers.findOne(
            { id: offerId },
            { populate: ['canonicalProduct', 'canonicalProduct.category', 'company', 'storefront'] },
        );

        if (!offer) {
            throw new NotFoundAppException(AppErrors.optimalCard.offerNotFound.message, {
                code: AppErrors.optimalCard.offerNotFound.code,
            });
        }

        return offer;
    }

    private async requireAdmin(adminUserId: string): Promise<AppUserEntity> {
        const admin = await this.users.findOne({ id: adminUserId, role: UserRole.ADMIN });

        if (!admin) {
            throw new UnauthorizedAppException(AppErrors.auth.unauthorized.message, {
                code: AppErrors.auth.unauthorized.code,
            });
        }

        if (!admin.isActive) {
            throw new ForbiddenAppException(AppErrors.auth.userInactive.message, {
                code: AppErrors.auth.userInactive.code,
            });
        }

        return admin;
    }
}

function requireRange(min: number, max: number): { min: string; max: string } {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0 || min > max) {
        throw new BadRequestAppException(AppErrors.optimalCard.qtyRange.message, {
            code: AppErrors.optimalCard.qtyRange.code,
        });
    }

    return { min: decimalString(min), max: decimalString(max) };
}

function resolvePrice(value: number | null | undefined, fallback: string | null): string | null {
    if (value === undefined) {
        return fallback;
    }

    if (value === null) {
        return null;
    }

    if (!Number.isFinite(value) || value < 0) {
        throw new BadRequestAppException(AppErrors.optimalCard.price.message, {
            code: AppErrors.optimalCard.price.code,
        });
    }

    return decimalString(value);
}

function resolveCurrency(value: string | null | undefined, fallback: string | null): string | null {
    if (value === undefined) {
        return fallback ? requireCurrency(fallback) : null;
    }

    if (value === null) {
        return null;
    }

    return requireCurrency(value);
}

function requireCurrency(value: string): string {
    const code = value.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(code)) {
        throw new BadRequestAppException(AppErrors.optimalCard.currency.message, {
            code: AppErrors.optimalCard.currency.code,
        });
    }

    return code;
}

function resolveExpiry(value: Date | null | undefined, now: Date): Date {
    if (value === undefined || value === null) {
        return new Date(now.getTime() + CARD_TTL_MS);
    }

    if (Number.isNaN(value.getTime())) {
        throw new BadRequestAppException(AppErrors.optimalCard.expiry.message, {
            code: AppErrors.optimalCard.expiry.code,
        });
    }

    return value;
}

function normalizeContact(card: OptimalCardEntity, adminEntered: boolean): void {
    if (adminEntered) {
        card.contactUrl = null;
        card.contactAdminEntered = true;
    }

    if (card.contactUrl) {
        card.contactAdminEntered = false;
    } else if (card.contactValue) {
        card.contactAdminEntered = true;
    }

    if ((card.contactValue && card.contactValue.length > 512) || (card.contactUrl && card.contactUrl.length > 2048)) {
        throw new BadRequestAppException(AppErrors.optimalCard.contact.message, {
            code: AppErrors.optimalCard.contact.code,
        });
    }

    if (card.contactValue || card.contactUrl) {
        card.contactEnteredAt = new Date();
    }
}

function picked(value: string | null | undefined, fallback: string | null): string | null {
    if (value === undefined) {
        return fallback;
    }

    return emptyToNull(value);
}

function emptyToNull(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new BadRequestAppException(AppErrors.optimalCard.attributes.message, {
            code: AppErrors.optimalCard.attributes.code,
        });
    }

    return value as Record<string, unknown>;
}
