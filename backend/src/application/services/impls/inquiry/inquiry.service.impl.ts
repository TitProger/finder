import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { CategoryClassifierPort } from '../../../ports/category-classifier.port';
import { findActingAdmin } from '../../../auth/acting-admin';
import { RESEARCH_LAUNCH_SERVICE, ResearchLaunchService } from '../research/research-launch.service';
import { MANAGER_HANDOFF, ManagerHandoffService } from '../manager/manager-handoff.service';
import {
    AssignCategoryInput,
    CreateCategoryAndAssignInput,
    CreateInquiryInput,
    InquiryService,
    InquiryView,
} from '../../contracts/inquiry/inquiry.service';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { ForbiddenAppException } from '../../../../common/exceptions/forbidden.exception';
import { InternalServerAppException } from '../../../../common/exceptions/internal-server.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { UnauthorizedAppException } from '../../../../common/exceptions/unauthorized.exception';
import { Envs } from '../../../../common/envs/env';
import { Logger } from '../../../../common/logger/logger';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { InquiryAnswerEntity } from '../../../../domain/entities/inquiry/inquiry-answer.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { PauseOutcome } from '../../../../domain/inquiry/classification';
import { LiveCardAnswer, selectLiveCard } from '../../../../domain/market/select-live-card';
import { displayPhrase, normalizePhrase } from '../../../../domain/text/phrase-text';
import { CategoryPhraseRepository } from '../../../../domain/repositories/category/category-phrase.repository';
import { CategoryQuestionRepository } from '../../../../domain/repositories/category/category-question.repository';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { QuestionPackRepository } from '../../../../domain/repositories/category/question-pack.repository';
import { InquiryAnswerRepository } from '../../../../domain/repositories/inquiry/inquiry-answer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { OptimalCardRepository } from '../../../../domain/repositories/market/optimal-card.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { compareAskedQuestions, isQuestionAsked, selectQuestionPack } from './inquiry-questions';
import { classifyInquiry, ClassificationDecision } from './classify-inquiry';

const LAUNCH_FAILED_TEXT = 'Не удалось запустить поиск. Напишите ещё раз, попробуем снова.';

const ASSIGNABLE_STATUSES = new Set<InquiryStatus>([
    InquiryStatus.DRAFT,
    InquiryStatus.AWAITING_CATEGORY,
    InquiryStatus.COLLECTING_ANSWERS,
]);

const PAUSE_REASON: Record<PauseOutcome, string> = {
    ambiguous_phrase: 'Сомнение классификатора: фраза есть в нескольких категориях.',
    ambiguous_keyword: 'Сомнение классификатора: ключевые слова подходят нескольким категориям.',
    llm_low_confidence: 'Сомнение классификатора: модель не уверена в выборе категории.',
    no_match: 'Сомнение классификатора: категория не выбрана.',
};

/**
 * Заявка и классификация.
 * Сомнение ставит паузу и не создаёт research_run.
 * Когда обязательных вопросов не осталось, живая карточка той же категории отдаётся сразу.
 * Нет карточки — запускается ресерч.
 */
@Injectable()
export class InquiryServiceImpl implements InquiryService {
    constructor(
        @Inject(REPOSITORY_TOKENS.INQUIRY_REPOSITORY)
        private readonly inquiries: InquiryRepository,
        @Inject(REPOSITORY_TOKENS.APP_USER_REPOSITORY)
        private readonly users: AppUserRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_REPOSITORY)
        private readonly categories: CategoryRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_PHRASE_REPOSITORY)
        private readonly phrases: CategoryPhraseRepository,
        @Inject(REPOSITORY_TOKENS.QUESTION_PACK_REPOSITORY)
        private readonly packs: QuestionPackRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_QUESTION_REPOSITORY)
        private readonly questions: CategoryQuestionRepository,
        @Inject(REPOSITORY_TOKENS.INQUIRY_ANSWER_REPOSITORY)
        private readonly answers: InquiryAnswerRepository,
        @Inject(REPOSITORY_TOKENS.OPTIMAL_CARD_REPOSITORY)
        private readonly optimalCards: OptimalCardRepository,
        private readonly llmClassifier?: CategoryClassifierPort,
        @Optional()
        @Inject(RESEARCH_LAUNCH_SERVICE)
        private readonly researchLaunch?: ResearchLaunchService,
        @Optional()
        @Inject(MANAGER_HANDOFF)
        private readonly handoff?: ManagerHandoffService,
    ) {}

    async create(input: CreateInquiryInput): Promise<InquiryView> {
        const text = requireClientText(input.text);
        const client = await this.createAnonymousClient();
        const decision = await this.classify(text);
        const category = await this.categoryFromDecision(decision);
        const pack = category ? await this.pickPack(category.id, text) : null;
        const inquiry = this.inquiries.create({
            clientUser: client,
            status: decision.kind === 'pause' ? InquiryStatus.AWAITING_CATEGORY : InquiryStatus.COLLECTING_ANSWERS,
            rawText: text,
            photoUrls: collectPhotoFileIds(input.photoFileIds),
            category,
            questionPack: pack,
            classificationScores: decision.scores,
            isPaused: decision.kind === 'pause',
            pauseReason: decision.kind === 'pause' ? PAUSE_REASON[decision.scores.outcome] : null,
            assignedByUser: null,
            optimalCard: null,
            closedAt: null,
        });

        await this.inquiries.getEntityManager().persistAndFlush(inquiry);
        await this.serveIfReady(inquiry);

        return this.viewOf(inquiry);
    }

    async getById(id: string): Promise<InquiryView> {
        const inquiry = await this.findInquiry(id);

        return this.viewOf(inquiry);
    }

    async assignCategory(input: AssignCategoryInput): Promise<InquiryView> {
        const inquiry = await this.requireAssignable(input.inquiryId);
        const admin = await this.adminOf(input.adminUserId);
        const category = await this.categories.findOne({ id: input.categoryId });

        if (!category) {
            throw new NotFoundAppException(AppErrors.category.notFound.message, {
                code: AppErrors.category.notFound.code,
            });
        }

        if (category.status !== CategoryStatus.ACTIVE) {
            throw new ConflictAppException(AppErrors.category.notActive.message, {
                code: AppErrors.category.notActive.code,
            });
        }

        await this.applyAssignment(inquiry, category, admin);
        await this.commitInquiry(inquiry);
        await this.serveIfReady(inquiry);

        return this.viewOf(inquiry);
    }

    async createCategoryAndAssign(input: CreateCategoryAndAssignInput): Promise<InquiryView> {
        const inquiry = await this.requireAssignable(input.inquiryId);
        const admin = await this.adminOf(input.adminUserId);
        const fields = requireCategoryFields(input.name, input.description);
        const duplicate = await this.categories.findOne({ name: fields.name });

        if (duplicate) {
            throw new ConflictAppException(AppErrors.category.nameConflict.message, {
                code: AppErrors.category.nameConflict.code,
            });
        }

        const category = this.categories.create({
            name: fields.name,
            description: fields.description,
            status: CategoryStatus.ACTIVE,
        });
        const em = this.inquiries.getEntityManager();

        em.persist(category);
        await this.applyAssignment(inquiry, category, admin);

        try {
            await this.commitInquiry(inquiry);
        } catch (error) {
            this.rethrowNameConflict(error);
        }

        await this.serveIfReady(inquiry);

        return this.viewOf(inquiry);
    }

    private async classify(text: string): Promise<ClassificationDecision> {
        const [categories, phrases] = await Promise.all([
            this.categories.find({ status: CategoryStatus.ACTIVE }),
            this.phrases.findByCategoryStatus(CategoryStatus.ACTIVE),
        ]);

        return classifyInquiry(
            text,
            phrases.map((phrase) => ({
                phrase: phrase.phrase,
                categoryId: phrase.category.id,
                categoryName: phrase.category.name,
                categoryStatus: phrase.category.status,
            })),
            categories.map((category) => ({
                id: category.id,
                code: category.code || null,
                name: category.name,
                description: category.description,
                status: category.status,
            })),
            this.llmClassifier,
            Envs.llm.confidenceThreshold,
        );
    }

    private async categoryFromDecision(decision: ClassificationDecision): Promise<CategoryEntity | null> {
        if (decision.kind !== 'confident') {
            return null;
        }

        const category = await this.categories.findOne({ id: decision.categoryId });

        if (!category || category.status !== CategoryStatus.ACTIVE) {
            throw new NotFoundAppException(AppErrors.category.notFound.message, {
                code: AppErrors.category.notFound.code,
            });
        }

        return category;
    }

    private async pickPack(categoryId: string, text: string): Promise<QuestionPackEntity | null> {
        const packs = await this.packs.find({ category: categoryId, isActive: true });
        const packId = selectQuestionPack(
            text,
            packs.map((pack) => ({
                id: pack.id,
                code: pack.code,
                title: pack.title,
                isActive: pack.isActive,
            })),
        );

        if (!packId) {
            return null;
        }

        return packs.find((pack) => pack.id === packId) ?? null;
    }

    private async applyAssignment(
        inquiry: InquiryEntity,
        category: CategoryEntity,
        admin: AppUserEntity,
    ): Promise<void> {
        const phraseText = displayPhrase(inquiry.rawText);

        if (!normalizePhrase(phraseText)) {
            throw new BadRequestAppException(AppErrors.inquiry.textEmpty.message, {
                code: AppErrors.inquiry.textEmpty.code,
            });
        }

        const existing = await this.phrases.find({ category: category.id });
        const already = existing.some((item) => normalizePhrase(item.phrase) === normalizePhrase(phraseText));

        if (!already) {
            const phrase = this.phrases.create({
                category,
                phrase: phraseText,
            });

            this.phrases.getEntityManager().persist(phrase);
        }

        inquiry.category = category;
        inquiry.questionPack = await this.pickPack(category.id, inquiry.rawText);
        inquiry.status = InquiryStatus.COLLECTING_ANSWERS;
        inquiry.isPaused = false;
        inquiry.pauseReason = null;
        inquiry.assignedByUser = admin;
    }

    /**
     * Поиск перед ресерчем. Совпадение пишет карточку и статус «ответ из базы».
     * Нет живой карточки — ресерч запускается сразу.
     */
    private async serveIfReady(inquiry: InquiryEntity): Promise<void> {
        if (inquiry.isPaused || inquiry.status !== InquiryStatus.COLLECTING_ANSWERS || !inquiry.category) {
            return;
        }

        const view = await this.viewOf(inquiry);
        const pending = await this.pendingQuestions(inquiry.id, view.questions);

        if (pending.length > 0) {
            return;
        }

        const stored = await this.answers.find({ inquiry: inquiry.id }, { populate: ['categoryQuestion'] });
        const byQuestion = new Map<string, InquiryAnswerEntity>();

        for (const answer of stored) {
            const questionId = safeRelationId(answer, 'categoryQuestion');

            if (questionId) {
                byQuestion.set(questionId, answer);
            }
        }

        const snapshots: LiveCardAnswer[] = view.questions.map((question) => {
            const answer = byQuestion.get(question.id);

            return {
                questionId: question.id,
                answerType: question.answerType,
                isRequired: question.isRequired,
                valueText: answer?.valueText ?? null,
                valueJson: answer?.valueJson ?? null,
            };
        });
        const live = await this.optimalCards.find(
            { category: inquiry.category.id, isLive: true },
            {
                populate: [
                    'quantityQuestion',
                    'canonicalProduct',
                    'category',
                    'offer',
                    'company',
                    'storefront',
                    'markedLiveByUser',
                ],
            },
        );
        const chosen = selectLiveCard(
            snapshots,
            live.map((card) => ({
                id: card.id,
                quantityQuestionId: safeRelationId(card, 'quantityQuestion') ?? '',
                qtyMin: card.qtyMin,
                qtyMax: card.qtyMax,
                productAttributes: card.productAttributes ?? null,
                expiresAt: card.expiresAt ?? null,
                markedLiveAt: card.markedLiveAt ?? null,
                isLive: card.isLive,
            })),
            new Date(),
        );

        if (!chosen) {
            await this.launchResearch(inquiry);

            return;
        }

        const card = live.find((item) => item.id === chosen.id);

        if (!card) {
            return;
        }

        inquiry.optimalCard = card;
        inquiry.status = InquiryStatus.SERVED_FROM_DATABASE;
        await this.commitInquiry(inquiry);
        await this.tellHandoff(() => this.handoff?.onCardServed(inquiry));
    }

    /**
     * Ошибка до записи прогона не должна глотаться: клиент получает текст и может повторить.
     * Если прогон уже в базе, статус RESEARCHING оставляем и не прячем его за исключением.
     */
    private async launchResearch(inquiry: InquiryEntity): Promise<void> {
        if (!this.researchLaunch) {
            return;
        }

        try {
            await this.researchLaunch.startForInquiry(inquiry);
        } catch (error) {
            const fresh = await this.findInquiry(inquiry.id);

            inquiry.status = fresh.status;
            Logger.error('Ресерч не запустился', Logger.statuses.FAIL, {
                data: { message: error instanceof Error ? error.message : String(error), inquiryId: inquiry.id },
            });

            if (fresh.status !== InquiryStatus.RESEARCHING) {
                throw new InternalServerAppException(LAUNCH_FAILED_TEXT);
            }
        }
    }

    /**
     * disableIdentityMap отдаёт загруженную заявку detached.
     * flush пишет только то, что снова положили в persist stack, иначе Postgres остаётся со старым статусом.
     */
    private async commitInquiry(inquiry: InquiryEntity): Promise<void> {
        const em = this.inquiries.getEntityManager();

        em.persist(inquiry);
        await em.flush();
    }

    private async viewOf(inquiry: InquiryEntity): Promise<InquiryView> {
        const categoryId = inquiry.category?.id ?? null;

        if (!categoryId) {
            return { inquiry, questions: [] };
        }

        const selectedPackId = inquiry.questionPack?.id ?? null;
        const loaded = await this.questions.find({ category: categoryId }, { populate: ['category', 'questionPack'] });
        const asked = loaded
            .filter((question) => isQuestionAsked(question.questionPack?.id ?? null, selectedPackId))
            .sort((left, right) =>
                compareAskedQuestions(
                    {
                        id: left.id,
                        sortOrder: left.sortOrder,
                        questionPackId: left.questionPack?.id ?? null,
                    },
                    {
                        id: right.id,
                        sortOrder: right.sortOrder,
                        questionPackId: right.questionPack?.id ?? null,
                    },
                ),
            );

        return { inquiry, questions: asked };
    }

    private async findInquiry(id: string): Promise<InquiryEntity> {
        const inquiry = await this.inquiries.findOne(
            { id },
            {
                populate: [
                    'clientUser',
                    'category',
                    'questionPack',
                    'assignedByUser',
                    'optimalCard',
                    'optimalCard.canonicalProduct',
                    'optimalCard.quantityQuestion',
                    'optimalCard.category',
                ],
            },
        );

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        return inquiry;
    }

    private async requireAssignable(id: string): Promise<InquiryEntity> {
        const inquiry = await this.findInquiry(id);

        if (!ASSIGNABLE_STATUSES.has(inquiry.status)) {
            throw new ConflictAppException(AppErrors.inquiry.notAssignable.message, {
                code: AppErrors.inquiry.notAssignable.code,
            });
        }

        return inquiry;
    }

    private async adminOf(adminUserId?: string): Promise<AppUserEntity> {
        if (!adminUserId) {
            return findActingAdmin(this.users);
        }

        return this.requireAdmin(adminUserId);
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

    private async createAnonymousClient(): Promise<AppUserEntity> {
        const created = this.users.create({
            role: UserRole.CLIENT,
            displayName: null,
            isActive: true,
        });
        const em = this.users.getEntityManager();

        em.persist(created);
        await em.flush();

        return created;
    }

    private async pendingQuestions(
        inquiryId: string,
        questions: CategoryQuestionEntity[],
    ): Promise<CategoryQuestionEntity[]> {
        const answers = await this.answers.find({ inquiry: inquiryId }, { populate: ['categoryQuestion'] });
        const answered = new Set<string>();
        let readable = 0;

        for (const answer of answers) {
            const questionId = safeRelationId(answer, 'categoryQuestion');

            if (!questionId) {
                continue;
            }

            readable += 1;
            answered.add(questionId);
        }

        // Строк столько же, сколько заданных вопросов, но FK вопроса не читается
        // (disableIdentityMap, связь не инициализирована). Повторно их не задаём.
        if (readable < answers.length && questions.length > 0 && answers.length >= questions.length) {
            return [];
        }

        return questions.filter((question) => !answered.has(question.id));
    }

    private rethrowNameConflict(error: unknown): never {
        if (error instanceof UniqueConstraintViolationException) {
            throw new ConflictAppException(AppErrors.category.nameConflict.message, {
                code: AppErrors.category.nameConflict.code,
            });
        }

        throw error;
    }

    private async tellHandoff(send: () => Promise<void> | undefined): Promise<void> {
        try {
            await send();
        } catch (error) {
            Logger.error('Уведомление менеджера не ушло', Logger.statuses.FAIL, {
                data: { message: error instanceof Error ? error.message : String(error) },
            });
        }
    }
}

function requireClientText(text: string): string {
    const display = displayPhrase(text);

    if (!normalizePhrase(display)) {
        throw new BadRequestAppException(AppErrors.inquiry.textEmpty.message, {
            code: AppErrors.inquiry.textEmpty.code,
        });
    }

    if (display.length > 8000) {
        throw new BadRequestAppException(AppErrors.inquiry.textTooLong.message, {
            code: AppErrors.inquiry.textTooLong.code,
        });
    }

    return display;
}

function collectPhotoFileIds(ids: readonly string[] | undefined): string[] {
    const unique: string[] = [];

    for (const raw of ids ?? []) {
        const value = raw.trim();

        if (!value || value.length > 512 || /\s/.test(value) || unique.includes(value)) {
            continue;
        }

        unique.push(value);

        if (unique.length === 10) {
            break;
        }
    }

    return unique;
}

function safeRelationId(owner: object, key: string): string | null {
    try {
        return relationId((owner as Record<string, unknown>)[key]);
    } catch {
        return null;
    }
}

function relationId(value: unknown): string | null {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    if (!value || typeof value !== 'object') {
        return null;
    }

    const id = (value as { id?: unknown }).id;

    return typeof id === 'string' && id.length > 0 ? id : null;
}

function requireCategoryFields(name: string, description: string): { name: string; description: string } {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName || !trimmedDescription) {
        throw new BadRequestAppException(AppErrors.inquiry.categoryFieldsEmpty.message, {
            code: AppErrors.inquiry.categoryFieldsEmpty.code,
        });
    }

    return { name: trimmedName, description: trimmedDescription };
}
