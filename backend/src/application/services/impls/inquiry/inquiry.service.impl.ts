import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { CategoryClassifierPort } from '../../../ports/category-classifier.port';
import { LimitCheckerService, LIMIT_CHECKER_SERVICE } from '../../contracts/tariff/limit-checker.service';
import { RESEARCH_LAUNCH_SERVICE, ResearchLaunchService } from '../research/research-launch.service';
import { MANAGER_HANDOFF, ManagerHandoffService } from '../manager/manager-handoff.service';
import { findActingAdmin } from '../../../telegram/acting-admin';
import { adminTelegramIds } from '../../../telegram/admin-telegram-ids';
import {
    AdminRecipient,
    AnswerQuestionInput,
    AssignCategoryInput,
    ClientDialog,
    CreateCategoryAndAssignInput,
    CreateInquiryInput,
    InquiryService,
    InquiryView,
    RejectCategoryInput,
    TelegramActor,
} from '../../contracts/inquiry/inquiry.service';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { ForbiddenAppException } from '../../../../common/exceptions/forbidden.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { UnauthorizedAppException } from '../../../../common/exceptions/unauthorized.exception';
import { Envs } from '../../../../common/envs/env';
import { Logger } from '../../../../common/logger/logger';
import { CategoryQuestionEntity } from '../../../../domain/entities/category/category-question.entity';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
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
import { formatAskedPrompt, parseInquiryAnswer } from './parse-inquiry-answer';

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
 * Когда обязательные ответы собраны, живая карточка той же категории отдаётся сразу.
 * Нет карточки — списывается дневной лимит и запускается ресерч.
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
        @Inject(LIMIT_CHECKER_SERVICE)
        private readonly limitChecker: LimitCheckerService,
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
        const client = await this.findOrCreateClient(input.telegramUserId);
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

    async resolveTelegramActor(telegramUserId: number): Promise<TelegramActor> {
        const telegramId = String(telegramUserId);
        let user = await this.users.findOne({ telegramUserId: telegramId });

        // Если пользователя нет, но его ID в списке админов - создаём админа
        if (!user && this.isAdminTelegramId(telegramId)) {
            user = await this.createAdminFromTelegram(telegramUserId);
        }

        if (!user) {
            return { kind: 'new_client', telegramUserId };
        }

        if (!user.isActive) {
            throw new ForbiddenAppException(AppErrors.auth.userInactive.message, {
                code: AppErrors.auth.userInactive.code,
            });
        }

        if (user.role === UserRole.ADMIN) {
            return { kind: 'admin', userId: user.id, telegramUserId };
        }

        if (user.role !== UserRole.CLIENT) {
            throw new ForbiddenAppException(AppErrors.inquiry.clientRole.message, {
                code: AppErrors.inquiry.clientRole.code,
            });
        }

        return { kind: 'client', userId: user.id, telegramUserId };
    }

    async listAdminRecipients(): Promise<AdminRecipient[]> {
        // Получаем всех админов из базы
        const admins = await this.users.find({ role: UserRole.ADMIN, isActive: true });

        // Также добавляем админов из env, которых ещё может не быть в базе
        const adminTelegramIds = Envs.admin.telegramIds.map((id) => toTelegramUserId(id)).filter((id) => id !== null);

        const recipients = new Map<number, AdminRecipient>();

        // Админы из базы
        for (const admin of admins) {
            const telegramUserId = toTelegramUserId(admin.telegramUserId);

            if (telegramUserId !== null) {
                recipients.set(telegramUserId, { userId: admin.id, telegramUserId });
            }
        }

        // Админы из env (если их нет в базе, создадим при первом обращении)
        for (const telegramUserId of adminTelegramIds) {
            if (!recipients.has(telegramUserId)) {
                // Временно добавляем с пустым userId - они будут созданы при первом контакте
                const existing = await this.users.findOne({ telegramUserId: String(telegramUserId) });

                if (existing) {
                    recipients.set(telegramUserId, { userId: existing.id, telegramUserId });
                }
            }
        }

        return Array.from(recipients.values());
    }

    async findClientDialog(telegramUserId: number): Promise<ClientDialog> {
        const inquiry = await this.latestOpenInquiry(telegramUserId);

        if (!inquiry) {
            return { kind: 'idle' };
        }

        return this.dialogFrom(await this.findInquiry(inquiry.id));
    }

    async answerQuestion(input: AnswerQuestionInput): Promise<ClientDialog> {
        const inquiry = await this.requireOwned(input.inquiryId, input.telegramUserId);

        if (inquiry.isPaused || inquiry.status !== InquiryStatus.COLLECTING_ANSWERS || !inquiry.category) {
            throw new ConflictAppException(AppErrors.inquiry.answerNotExpected.message, {
                code: AppErrors.inquiry.answerNotExpected.code,
            });
        }

        const view = await this.viewOf(inquiry);
        const pending = await this.pendingQuestions(inquiry.id, view.questions);
        const question = pending[0];

        if (!question) {
            throw new ConflictAppException(AppErrors.inquiry.answerNotExpected.message, {
                code: AppErrors.inquiry.answerNotExpected.code,
            });
        }

        const parsed = parseInquiryAnswer(question.answerType, question.choices, input.text);
        const row = this.answers.create({
            inquiry,
            categoryQuestion: question,
            valueText: parsed.valueText,
            valueJson: parsed.valueJson,
            answeredAt: new Date(),
        });
        const em = this.answers.getEntityManager();

        em.persist(row);
        await em.flush();

        const remaining = pending.slice(1);

        if (remaining.length === 0) {
            await this.serveIfReady(inquiry);

            return { kind: 'complete', view };
        }

        const next = remaining[0];

        return {
            kind: 'asking',
            view,
            prompt: formatAskedPrompt(next.prompt, next.choices),
            index: view.questions.length - remaining.length,
            total: view.questions.length,
        };
    }

    async rejectCategory(input: RejectCategoryInput): Promise<InquiryView> {
        const inquiry = await this.requireOwned(input.inquiryId, input.telegramUserId);

        if (inquiry.status !== InquiryStatus.COLLECTING_ANSWERS || !inquiry.category) {
            throw new ConflictAppException(AppErrors.inquiry.notRejectable.message, {
                code: AppErrors.inquiry.notRejectable.code,
            });
        }

        const existing = await this.answers.find({ inquiry: inquiry.id });
        const em = this.inquiries.getEntityManager();

        for (const answer of existing) {
            em.remove(answer);
        }

        inquiry.category = null;
        inquiry.questionPack = null;
        inquiry.status = InquiryStatus.AWAITING_CATEGORY;
        inquiry.isPaused = true;
        inquiry.pauseReason = 'Клиент сказал, что это не та категория.';
        await this.commitInquiry(inquiry);

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
     * Совпадение с живой карточкой лимит не тратит.
     * Промах списывает лимит один раз и создаёт research_run.
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

        const stored = await this.answers.find({ inquiry: inquiry.id });
        const byQuestion = new Map(stored.map((answer) => [answer.categoryQuestion.id, answer]));
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
                quantityQuestionId: card.quantityQuestion.id,
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
            // Нет готовой карточки - нужен ресерч
            // Проверяем дневной лимит
            const telegramId = inquiry.clientUser.telegramUserId ?? '';
            const limitCheck = await this.limitChecker.canStartResearch(inquiry.clientUser.id, telegramId);

            if (!limitCheck.allowed) {
                // Лимит исчерпан - используем отдельный статус, чтобы не триггерить admin category card
                inquiry.isPaused = true;
                inquiry.pauseReason = 'Исчерпан дневной лимит запросов. Попробуйте завтра или обратитесь к менеджеру.';
                inquiry.status = InquiryStatus.LIMIT_EXCEEDED;
                await this.commitInquiry(inquiry);

                return;
            }

            await this.limitChecker.incrementResearchUsage(inquiry.clientUser.id);

            if (this.researchLaunch) {
                await this.researchLaunch.startForInquiry(inquiry);
            }

            return;
        }

        const card = live.find((item) => item.id === chosen.id);

        if (!card) {
            return;
        }

        // Нашли готовую карточку - лимит не расходуется
        inquiry.optimalCard = card;
        inquiry.status = InquiryStatus.SERVED_FROM_DATABASE;
        await this.commitInquiry(inquiry);
        await this.tellHandoff(() => this.handoff?.onCardServed(inquiry));
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

    private async findOrCreateClient(telegramUserId: number): Promise<AppUserEntity> {
        const telegramId = String(telegramUserId);
        const existing = await this.users.findOne({ telegramUserId: telegramId });

        if (existing) {
            return this.requireActiveClient(existing);
        }

        const created = this.users.create({
            role: UserRole.CLIENT,
            telegramUserId: telegramId,
            displayName: null,
            isActive: true,
            planCode: 'free',
        });
        const em = this.users.getEntityManager();

        em.persist(created);
        await em.flush();

        return created;
    }

    private requireActiveClient(user: AppUserEntity): AppUserEntity {
        if (user.role !== UserRole.CLIENT) {
            throw new ForbiddenAppException(AppErrors.inquiry.clientRole.message, {
                code: AppErrors.inquiry.clientRole.code,
            });
        }

        if (!user.isActive) {
            throw new ForbiddenAppException(AppErrors.auth.userInactive.message, {
                code: AppErrors.auth.userInactive.code,
            });
        }

        return user;
    }

    private async latestOpenInquiry(telegramUserId: number): Promise<InquiryEntity | null> {
        const user = await this.users.findOne({ telegramUserId: String(telegramUserId) });

        if (!user || user.role !== UserRole.CLIENT) {
            return null;
        }

        const rows = await this.inquiries.find({ clientUser: user.id });
        const open = rows
            .map((inquiry, index) => ({ inquiry, index }))
            .filter(
                ({ inquiry }) =>
                    inquiry.status === InquiryStatus.AWAITING_CATEGORY ||
                    inquiry.status === InquiryStatus.COLLECTING_ANSWERS,
            )
            .sort((left, right) => {
                const delta = right.inquiry.createdAt.getTime() - left.inquiry.createdAt.getTime();

                if (delta !== 0) {
                    return delta;
                }

                return right.index - left.index;
            });

        return open[0]?.inquiry ?? null;
    }

    private async dialogFrom(inquiry: InquiryEntity): Promise<ClientDialog> {
        const view = await this.viewOf(inquiry);

        if (inquiry.isPaused || inquiry.status === InquiryStatus.AWAITING_CATEGORY || !inquiry.category) {
            return { kind: 'paused', view };
        }

        const pending = await this.pendingQuestions(inquiry.id, view.questions);

        if (pending.length === 0) {
            return { kind: 'idle' };
        }

        const question = pending[0];

        return {
            kind: 'asking',
            view,
            prompt: formatAskedPrompt(question.prompt, question.choices),
            index: view.questions.length - pending.length,
            total: view.questions.length,
        };
    }

    private async pendingQuestions(
        inquiryId: string,
        questions: CategoryQuestionEntity[],
    ): Promise<CategoryQuestionEntity[]> {
        const answers = await this.answers.find({ inquiry: inquiryId });
        const answered = new Set(answers.map((answer) => answer.categoryQuestion.id));

        return questions.filter((question) => !answered.has(question.id));
    }

    private async requireOwned(id: string, telegramUserId: number): Promise<InquiryEntity> {
        const inquiry = await this.findInquiry(id);
        const owner = await this.ownerOf(inquiry);

        if (normalizeTelegramId(owner.telegramUserId) !== normalizeTelegramId(telegramUserId)) {
            throw new ForbiddenAppException(AppErrors.inquiry.notClient.message, {
                code: AppErrors.inquiry.notClient.code,
            });
        }

        if (owner.role !== UserRole.CLIENT) {
            throw new ForbiddenAppException(AppErrors.inquiry.clientRole.message, {
                code: AppErrors.inquiry.clientRole.code,
            });
        }

        return inquiry;
    }

    /** Связь может прийти только с id. Тогда telegram id и роль пустые, хотя строка app_user на месте. */
    private async ownerOf(inquiry: InquiryEntity): Promise<AppUserEntity> {
        const linked = inquiry.clientUser;

        if (linked?.id && linked.telegramUserId != null && linked.role != null) {
            return linked;
        }

        if (!linked?.id) {
            throw new ForbiddenAppException(AppErrors.inquiry.notClient.message, {
                code: AppErrors.inquiry.notClient.code,
            });
        }

        const reloaded = await this.users.findOne({ id: linked.id });

        if (!reloaded) {
            throw new ForbiddenAppException(AppErrors.inquiry.notClient.message, {
                code: AppErrors.inquiry.notClient.code,
            });
        }

        inquiry.clientUser = reloaded;

        return reloaded;
    }

    private rethrowNameConflict(error: unknown): never {
        if (error instanceof UniqueConstraintViolationException) {
            throw new ConflictAppException(AppErrors.category.nameConflict.message, {
                code: AppErrors.category.nameConflict.code,
            });
        }

        throw error;
    }

    private isAdminTelegramId(telegramId: string): boolean {
        return adminTelegramIds().includes(telegramId);
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

    private async createAdminFromTelegram(telegramUserId: number): Promise<AppUserEntity> {
        const telegramId = String(telegramUserId);
        const admin = this.users.create({
            role: UserRole.ADMIN,
            telegramUserId: telegramId,
            displayName: `Admin ${telegramUserId}`,
            isActive: true,
            planCode: 'unlimited',
        });
        const em = this.users.getEntityManager();

        em.persist(admin);
        await em.flush();

        return admin;
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

function normalizeTelegramId(value: string | number | bigint | null | undefined): string | null {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
        return null;
    }

    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
        return null;
    }

    const text = String(value).trim();

    if (!/^[1-9]\d{0,15}$/.test(text)) {
        return null;
    }

    return text;
}

function toTelegramUserId(value: string | number | bigint | null | undefined): number | null {
    const text = normalizeTelegramId(value);

    if (!text) {
        return null;
    }

    const parsed = Number(text);

    if (!Number.isSafeInteger(parsed)) {
        return null;
    }

    return parsed;
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
