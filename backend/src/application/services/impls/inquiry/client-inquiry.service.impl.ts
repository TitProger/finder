import { Inject, Injectable, Optional } from '@nestjs/common';

import { AppErrors } from '../../../errors';
import { CategoryClassifierPort } from '../../../ports/category-classifier.port';
import { ClientInquiryService, CreateClientInquiryInput } from '../../contracts/inquiry/client-inquiry.service';
import { DOSSIER_SERVICE, DossierService } from '../../contracts/market/dossier.service';
import { RESEARCH_QUEUE_SERVICE, ResearchQueueService } from '../../contracts/research/research-queue.service';
import { StoredFileService } from '../file/stored-file.service';
import { BadRequestAppException } from '../../../../common/exceptions/bad-request.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { Envs } from '../../../../common/envs/env';
import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { QuestionPackEntity } from '../../../../domain/entities/category/question-pack.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { UserRole } from '../../../../domain/enums/user-role.enum';
import { PauseOutcome } from '../../../../domain/inquiry/classification';
import { displayPhrase } from '../../../../domain/text/phrase-text';
import { CategoryPhraseRepository } from '../../../../domain/repositories/category/category-phrase.repository';
import { CategoryRepository } from '../../../../domain/repositories/category/category.repository';
import { QuestionPackRepository } from '../../../../domain/repositories/category/question-pack.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { TaxonomyNodeRepository } from '../../../../domain/repositories/taxonomy/taxonomy-node.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { selectQuestionPack } from './inquiry-questions';
import { classifyInquiry, ClassificationDecision } from './classify-inquiry';

const PAUSE_REASON: Record<PauseOutcome, string> = {
    ambiguous_phrase: 'Сомнение классификатора: фраза есть в нескольких категориях.',
    ambiguous_keyword: 'Сомнение классификатора: ключевые слова подходят нескольким категориям.',
    llm_low_confidence: 'Сомнение классификатора: модель не уверена в выборе категории.',
    no_match: 'Сомнение классификатора: категория не выбрана.',
};

/**
 * Клиентская заявка сайта. Без telegramUserId. Фото — id stored_file.
 * Сначала живое досье (exact/similar), иначе очередь Postgres.
 */
@Injectable()
export class ClientInquiryServiceImpl implements ClientInquiryService {
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
        @Inject(REPOSITORY_TOKENS.TAXONOMY_NODE_REPOSITORY)
        private readonly taxonomyNodes: TaxonomyNodeRepository,
        private readonly files: StoredFileService,
        @Inject(RESEARCH_QUEUE_SERVICE)
        private readonly researchQueue: ResearchQueueService,
        @Inject(DOSSIER_SERVICE)
        private readonly dossiers: DossierService,
        @Optional()
        private readonly llmClassifier?: CategoryClassifierPort,
    ) {}

    async create(input: CreateClientInquiryInput): Promise<InquiryEntity> {
        const text = requireClientText(input.text);
        const mediaIds = await this.files.requireIds(input.mediaIds ?? []);
        const taxonomyNode = await this.requireTaxonomyNode(input.taxonomyNodeId);
        const profileJson = normalizeProfileJson(input.profileJson);
        const client = await this.createWebClient();
        const decision = await this.classify(text);
        const category = await this.categoryFromDecision(decision);
        const pack = category ? await this.pickPack(category.id, text) : null;
        const paused = decision.kind === 'pause';
        const cached =
            !paused && category
                ? await this.dossiers.findLiveForRequest({
                      categoryId: category.id,
                      rawText: text,
                      answers: answersFromProfile(profileJson),
                  })
                : null;
        const inquiry = this.inquiries.create({
            clientUser: client,
            status: paused
                ? InquiryStatus.AWAITING_CATEGORY
                : cached
                  ? InquiryStatus.SERVED_FROM_DATABASE
                  : InquiryStatus.COLLECTING_ANSWERS,
            rawText: text,
            photoUrls: mediaIds,
            profileJson,
            category,
            taxonomyNode,
            questionPack: pack,
            classificationScores: decision.scores,
            isPaused: paused,
            pauseReason: paused ? PAUSE_REASON[decision.scores.outcome] : null,
            assignedByUser: null,
            optimalCard: cached?.dossier ?? null,
            closedAt: null,
        });

        const em = this.inquiries.getEntityManager();

        em.persist(inquiry);
        await em.flush();

        if (!paused && category && !cached) {
            await this.researchQueue.enqueue(inquiry);
        }

        return inquiry;
    }

    async getById(id: string): Promise<InquiryEntity> {
        const inquiry = await this.inquiries.findOne(
            { id },
            { populate: ['category', 'taxonomyNode'] },
        );

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        return inquiry;
    }

    private async createWebClient(): Promise<AppUserEntity> {
        const created = this.users.create({
            role: UserRole.CLIENT,
            displayName: 'web',
            isActive: true,
        });
        const em = this.users.getEntityManager();

        em.persist(created);
        await em.flush();

        return created;
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

    private async requireTaxonomyNode(nodeId: number | null | undefined) {
        if (nodeId == null) {
            return null;
        }

        const node = await this.taxonomyNodes.findOne({ id: nodeId });

        if (!node) {
            throw new BadRequestAppException(AppErrors.taxonomy.invalidNode.message, {
                code: AppErrors.taxonomy.invalidNode.code,
            });
        }

        return node;
    }
}

function requireClientText(raw: string): string {
    const display = displayPhrase(raw);

    if (!display) {
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

function answersFromProfile(
    profile: Record<string, unknown> | null,
): Array<{
    questionId: string;
    answerType: string;
    isRequired: boolean;
    valueText: string | null;
    valueJson: unknown;
}> {
    if (!profile) {
        return [];
    }

    const answers: Array<{
        questionId: string;
        answerType: string;
        isRequired: boolean;
        valueText: string | null;
        valueJson: unknown;
    }> = [];

    for (const [questionId, value] of Object.entries(profile)) {
        if (value === null || value === undefined) {
            continue;
        }

        answers.push({
            questionId,
            answerType: typeof value === 'number' ? 'NUMBER' : 'TEXT',
            isRequired: true,
            valueText: typeof value === 'string' || typeof value === 'number' ? String(value) : null,
            valueJson: value,
        });
    }

    return answers;
}

/** Недостающее поле остаётся null; ключи не выдумываются. */
function normalizeProfileJson(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (value == null) {
        return null;
    }

    const out: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
        out[key] = item === undefined ? null : item;
    }

    return out;
}
