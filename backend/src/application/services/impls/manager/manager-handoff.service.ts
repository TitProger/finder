import { Inject, Injectable, Optional } from '@nestjs/common';

import { Logger } from '../../../../common/logger/logger';
import { AppErrors } from '../../../errors';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { ForbiddenAppException } from '../../../../common/exceptions/forbidden.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { MANAGER_NOTIFY, ManagerButton, ManagerNotifyPort } from '../../../ports/manager-notify.port';
import { adminChatIds } from '../../../telegram/admin-telegram-ids';
import {
    CreateOptimalCardInput,
    OPTIMAL_CARD_SERVICE,
    OptimalCardService,
} from '../../contracts/market/optimal-card.service';
import { OfferEntity } from '../../../../domain/entities/catalog/offer.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { OptimalCardEntity } from '../../../../domain/entities/market/optimal-card.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { MarketPriceLayer } from '../../../../domain/enums/market-price-layer.enum';
import {
    aggregateLayerPrices,
    formatLayerLines,
    readFallbackRates,
    readFxTable,
} from '../../../../domain/market/layer-prices';
import { QuestionAnswerType } from '../../../../domain/enums/question-answer-type.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { OfferRepository } from '../../../../domain/repositories/catalog/offer.repository';
import { CategoryQuestionRepository } from '../../../../domain/repositories/category/category-question.repository';
import { InquiryAnswerRepository } from '../../../../domain/repositories/inquiry/inquiry-answer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { OptimalCardRepository } from '../../../../domain/repositories/market/optimal-card.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';

export const MANAGER_HANDOFF = Symbol('MANAGER_HANDOFF');

const LAYERS = [
    MarketPriceLayer.FACTORY,
    MarketPriceLayer.CHINA_OPEN,
    MarketPriceLayer.RUSSIA_RETAIL,
    MarketPriceLayer.RUSSIA_WHOLESALE,
] as const;

const SUMMARY_LIMIT = 700;
const FACTORY_LIMIT = 3;

/**
 * Сообщения менеджерам и кнопки по заявке.
 * Сбой доставки пишется в прогон и не пробрасывается наружу: приём досье уже завершён.
 */
@Injectable()
export class ManagerHandoffService {
    constructor(
        @Inject(REPOSITORY_TOKENS.INQUIRY_REPOSITORY)
        private readonly inquiries: InquiryRepository,
        @Inject(REPOSITORY_TOKENS.INQUIRY_ANSWER_REPOSITORY)
        private readonly answers: InquiryAnswerRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_QUESTION_REPOSITORY)
        private readonly questions: CategoryQuestionRepository,
        @Inject(REPOSITORY_TOKENS.OFFER_REPOSITORY)
        private readonly offers: OfferRepository,
        @Inject(REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY)
        private readonly runs: ResearchRunRepository,
        @Inject(REPOSITORY_TOKENS.OPTIMAL_CARD_REPOSITORY)
        private readonly cards: OptimalCardRepository,
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
        @Inject(OPTIMAL_CARD_SERVICE)
        private readonly optimalCards: OptimalCardService,
        @Optional()
        @Inject(MANAGER_NOTIFY)
        private readonly notify?: ManagerNotifyPort,
    ) {}

    async onCardServed(inquiry: InquiryEntity): Promise<void> {
        const card = inquiry.optimalCard;
        const lines = [
            'Нашлась оптимальная карточка.',
            `Текст: ${clip(inquiry.rawText, SUMMARY_LIMIT)}`,
            `Категория: ${inquiry.category?.name ?? '—'}`,
            `Продавец: ${card?.company?.name || card?.company?.legalNameZh || '—'}`,
            `Цена: ${card?.price ?? '—'} ${card?.currency ?? ''}`.trim(),
            `Ссылка: ${card?.offer?.sourceUrl || card?.contactUrl || '—'}`,
        ];

        await this.fanout(lines.join('\n'), managerButtons(inquiry.id), null);
    }

    async onDossierReady(inquiry: InquiryEntity, run: ResearchRunEntity): Promise<void> {
        const offers = await this.offers.find({ researchRun: run.id });
        const counts = countByLayer(offers);
        const factory = bestFactory(offers);
        const sites = siteLines(run.sites);
        const companies = run.ingestResult?.counts.companies ?? 0;
        const partial = run.dossierStatus === 'partial';
        const lines = [
            partial ? 'Досье готово, частично.' : 'Досье готово.',
            `Текст: ${clip(inquiry.rawText, SUMMARY_LIMIT)}`,
            `Категория: ${inquiry.category?.name ?? '—'}`,
            `Частичное: ${partial ? 'да' : 'нет'}`,
            `Кратко: ${clip(run.summaryRu ?? '—', SUMMARY_LIMIT)}`,
            `Компаний: ${companies}`,
            `Офферы: ${LAYERS.map((layer) => `${layer} ${counts.get(layer) ?? 0}`).join(', ')}`,
            `Площадки: ${sites || '—'}`,
            'Заводские:',
            factory.length > 0 ? factory.map((line, index) => `${index + 1}. ${line}`).join('\n') : '—',
            formatLayerLines(layerQuotes(offers, run.fx)),
        ];

        await this.fanout(lines.join('\n'), managerButtons(inquiry.id), run);
    }

    async onRunProblem(run: ResearchRunEntity): Promise<void> {
        const inquiry = await this.inquiryOf(run);
        const title =
            run.status === ResearchRunStatus.STALE
                ? 'Ресерч завис.'
                : run.status === ResearchRunStatus.FAILED
                  ? 'Досье failed.'
                  : 'Ресерч не запустился.';
        const lines = [
            title,
            `Текст: ${clip(inquiry?.rawText ?? '—', SUMMARY_LIMIT)}`,
            `Категория: ${inquiry?.category?.name ?? '—'}`,
            `Причина: ${clip(run.failureReason || run.triggerLastError || run.summaryRu || '—', SUMMARY_LIMIT)}`,
        ];

        await this.fanout(lines.join('\n'), managerButtons(inquiry?.id ?? run.inquiry?.id ?? ''), run);
    }

    async makeOptimal(inquiryId: string, adminUserId: string): Promise<OptimalCardEntity> {
        await this.requireAdmin(adminUserId);

        const inquiry = await this.requireInquiry(inquiryId);
        const category = inquiry.category;

        if (!category) {
            throw new ConflictAppException(AppErrors.research.noCategory.message, {
                code: AppErrors.research.noCategory.code,
            });
        }

        const run = await this.latestDossier(inquiry.id);
        const offer = await this.topFactoryOffer(run);

        if (!offer) {
            throw new ConflictAppException(AppErrors.research.noFactoryOffer.message, {
                code: AppErrors.research.noFactoryOffer.code,
            });
        }

        const existing = await this.cards.find({ category: category.id, isLive: true });
        const current = existing[0];

        if (current) {
            current.offer = offer;
            current.company = offer.company ?? null;
            current.price = offer.price ?? current.price;
            current.currency = offer.currency ?? current.currency;
            current.contactUrl = offer.sourceUrl;
            current.reasonNote = 'Обновлено из заводского оффера досье';
            current.isLive = true;
            current.markedLiveAt = new Date();

            const em = this.cards.getEntityManager();

            em.persist(current);
            await em.flush();

            return current;
        }

        const question = await this.quantityQuestion(category.id);
        const qty = await this.quantityOf(inquiry.id, question.id, offer);
        const input: CreateOptimalCardInput = {
            adminUserId,
            categoryId: category.id,
            offerId: offer.id,
            nameRu: clip(offer.title || inquiry.rawText, 200),
            qtyMin: qty,
            qtyMax: qty,
            quantityQuestionId: question.id,
            productAttributes: {},
            isLive: true,
            price: offer.price === undefined || offer.price === null ? null : Number(offer.price),
            currency: offer.currency ?? null,
            contactUrl: offer.sourceUrl,
            reasonNote: 'Собрано из заводского оффера досье',
        };

        return this.optimalCards.create(input);
    }

    async close(inquiryId: string, adminUserId: string): Promise<InquiryEntity> {
        await this.requireAdmin(adminUserId);

        const inquiry = await this.requireInquiry(inquiryId);

        inquiry.status = InquiryStatus.CLOSED;
        inquiry.closedAt = inquiry.closedAt ?? new Date();
        inquiry.isPaused = false;

        const em = this.inquiries.getEntityManager();

        em.persist(inquiry);
        await em.flush();

        return inquiry;
    }

    private async fanout(text: string, buttons: ManagerButton[][], run: ResearchRunEntity | null): Promise<void> {
        if (!this.notify) {
            return;
        }

        const chats = adminChatIds();

        if (chats.length === 0) {
            Logger.warn('Нет ADMIN_TELEGRAM_IDS, менеджеру не написали', Logger.statuses.WARNING);

            return;
        }

        const errors: string[] = [];

        for (const chatId of chats) {
            try {
                await this.notify.send(chatId, text, buttons);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Telegram не принял сообщение';

                errors.push(`${chatId}: ${message}`);
                Logger.error('Не удалось написать менеджеру', Logger.statuses.FAIL, {
                    data: { chatId, message },
                });
            }
        }

        if (!run || errors.length === 0) {
            return;
        }

        run.notifyLastError = errors.join('; ').slice(0, 2000);

        const em = this.runs.getEntityManager();

        em.persist(run);
        await em.flush();
    }

    private async requireAdmin(adminUserId: string) {
        const admin = await this.users.findOne({ id: adminUserId });

        if (!admin || admin.role !== UserRole.ADMIN || !admin.isActive) {
            throw new ForbiddenAppException(AppErrors.auth.forbidden.message, {
                code: AppErrors.auth.forbidden.code,
            });
        }

        return admin;
    }

    private async requireInquiry(id: string): Promise<InquiryEntity> {
        const inquiry = await this.inquiries.findOne({ id }, { populate: ['category', 'clientUser'] });

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        return inquiry;
    }

    private async inquiryOf(run: ResearchRunEntity): Promise<InquiryEntity | null> {
        const id = run.inquiry?.id;

        if (!id) {
            return null;
        }

        if (run.inquiry?.rawText) {
            return run.inquiry;
        }

        return this.inquiries.findOne({ id }, { populate: ['category'] });
    }

    private async latestDossier(inquiryId: string): Promise<ResearchRunEntity | null> {
        const rows = await this.runs.find({ inquiry: inquiryId });
        const ready = rows.filter((run) => run.payloadSha256 && run.dossierStatus !== 'failed');

        ready.sort((left, right) => (right.finishedAt?.getTime() ?? 0) - (left.finishedAt?.getTime() ?? 0));

        return ready[0] ?? null;
    }

    private async topFactoryOffer(run: ResearchRunEntity | null): Promise<OfferEntity | null> {
        if (!run) {
            return null;
        }

        const rows = await this.offers.find({ researchRun: run.id });
        const factory = rows.filter((offer) => offer.layer === MarketPriceLayer.FACTORY);

        factory.sort((left, right) => priceRank(left) - priceRank(right));

        return factory[0] ?? null;
    }

    private async quantityQuestion(categoryId: string) {
        const questions = await this.questions.find({ category: categoryId });
        const question = questions.find((item) => item.isRequired && item.answerType === QuestionAnswerType.NUMBER);

        if (!question) {
            throw new ConflictAppException(AppErrors.optimalCard.quantityQuestion.message, {
                code: AppErrors.optimalCard.quantityQuestion.code,
            });
        }

        return question;
    }

    private async quantityOf(inquiryId: string, questionId: string, offer: OfferEntity): Promise<number> {
        const stored = await this.answers.find({ inquiry: inquiryId });
        const answer = stored.find((item) => item.categoryQuestion?.id === questionId);
        const fromAnswer = Number(answer?.valueText);
        const fromOffer = Number(offer.qtyFrom);

        if (Number.isFinite(fromAnswer) && fromAnswer >= 0) {
            return fromAnswer;
        }

        if (Number.isFinite(fromOffer) && fromOffer >= 0) {
            return fromOffer;
        }

        return 1;
    }
}

function managerButtons(inquiryId: string): ManagerButton[][] {
    if (!inquiryId) {
        return [];
    }

    return [
        [{ text: 'Сделать оптимальной', callbackData: `mo:${inquiryId}` }],
        [
            { text: 'Закрыть', callbackData: `cl:${inquiryId}` },
            { text: 'Перезапустить', callbackData: `rr:${inquiryId}` },
        ],
        [{ text: 'Рассчитать', callbackData: `ec:${inquiryId}` }],
    ];
}

function layerQuotes(offers: readonly OfferEntity[], fx: unknown) {
    return aggregateLayerPrices(
        offers.flatMap((offer) => {
            if (offer.price === null || offer.price === undefined) {
                return [];
            }

            const price = Number(offer.price);

            if (!Number.isFinite(price)) {
                return [];
            }

            return [
                {
                    layer: offer.layer ?? null,
                    unit: offer.unit ?? null,
                    price,
                    currency: offer.currency ?? null,
                },
            ];
        }),
        readFxTable(fx),
        readFallbackRates(),
    );
}

function countByLayer(offers: readonly OfferEntity[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const offer of offers) {
        const layer = offer.layer ?? 'NONE';

        counts.set(layer, (counts.get(layer) ?? 0) + 1);
    }

    return counts;
}

function bestFactory(offers: readonly OfferEntity[]): string[] {
    return offers
        .filter((offer) => offer.layer === MarketPriceLayer.FACTORY)
        .sort((left, right) => priceRank(left) - priceRank(right))
        .slice(0, FACTORY_LIMIT)
        .map((offer) => {
            const price = `${offer.price ?? '—'} ${offer.currency ?? ''}`.trim();

            return `${price} — ${offer.sourceUrl}${offer.site ? ` (${offer.site})` : ''}`;
        });
}

function priceRank(offer: OfferEntity): number {
    const value = Number(offer.price);

    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function siteLines(sites: unknown): string {
    if (!Array.isArray(sites)) {
        return '';
    }

    return sites
        .map((site) => {
            if (!site || typeof site !== 'object') {
                return null;
            }

            const row = site as { site?: unknown; status?: unknown };

            if (typeof row.site !== 'string' || typeof row.status !== 'string') {
                return null;
            }

            return `${row.site} — ${row.status}`;
        })
        .filter((line): line is string => line !== null)
        .join('; ');
}

function clip(text: string, limit: number): string {
    const trimmed = text.trim();

    if (trimmed.length <= limit) {
        return trimmed;
    }

    return `${trimmed.slice(0, limit - 1)}…`;
}
