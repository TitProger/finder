import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { Logger } from '../../../../common/logger/logger';
import { AppErrors } from '../../../errors';
import { ConflictAppException } from '../../../../common/exceptions/conflict.exception';
import { NotFoundAppException } from '../../../../common/exceptions/not-found.exception';
import { RESEARCH_TRIGGER, ResearchTriggerBody, ResearchTriggerPort } from '../../../ports/research-trigger.port';
import { MANAGER_HANDOFF, ManagerHandoffService } from '../manager/manager-handoff.service';
import { CategorySiteEntity } from '../../../../domain/entities/category/category-site.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { CategorySiteRepository } from '../../../../domain/repositories/category/category-site.repository';
import { InquiryAnswerRepository } from '../../../../domain/repositories/inquiry/inquiry-answer.repository';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';

export const RESEARCH_LAUNCH_SERVICE = Symbol('RESEARCH_LAUNCH_SERVICE');

const TRIGGER_SOURCE = 'research_trigger';
const RERUN_STATUSES = new Set<InquiryStatus>([InquiryStatus.RESEARCHING, InquiryStatus.DOSSIER_WITH_ADMIN]);
const OPEN_TRIGGER_STATUSES = new Set<ResearchRunStatus>([ResearchRunStatus.PENDING, ResearchRunStatus.RUNNING]);

export type ResearchRerunResult = {
    inquiryId: string;
    runId: string;
    inquiryStatus: InquiryStatus;
    runStatus: ResearchRunStatus;
};

/**
 * Создаёт прогон и зовёт webhook. Лимит клиента здесь не трогается:
 * его списывает единственная точка в InquiryService, повторные попытки и rerun — нет.
 */
@Injectable()
export class ResearchLaunchService {
    constructor(
        @Inject(REPOSITORY_TOKENS.INQUIRY_REPOSITORY)
        private readonly inquiries: InquiryRepository,
        @Inject(REPOSITORY_TOKENS.INQUIRY_ANSWER_REPOSITORY)
        private readonly answers: InquiryAnswerRepository,
        @Inject(REPOSITORY_TOKENS.CATEGORY_SITE_REPOSITORY)
        private readonly sites: CategorySiteRepository,
        @Inject(REPOSITORY_TOKENS.RESEARCH_RUN_REPOSITORY)
        private readonly runs: ResearchRunRepository,
        @Optional()
        @Inject(RESEARCH_TRIGGER)
        private readonly trigger?: ResearchTriggerPort,
        @Optional()
        @Inject(MANAGER_HANDOFF)
        private readonly handoff?: ManagerHandoffService,
    ) {}

    async startForInquiry(inquiry: InquiryEntity): Promise<ResearchRunEntity> {
        return this.openRun(inquiry);
    }

    async rerun(inquiryId: string): Promise<ResearchRerunResult> {
        const inquiry = await this.inquiries.findOne({ id: inquiryId }, { populate: ['category', 'questionPack'] });

        if (!inquiry) {
            throw new NotFoundAppException(AppErrors.inquiry.notFound.message, {
                code: AppErrors.inquiry.notFound.code,
            });
        }

        if (!inquiry.category || !RERUN_STATUSES.has(inquiry.status)) {
            throw new ConflictAppException(AppErrors.research.rerunNotAllowed.message, {
                code: AppErrors.research.rerunNotAllowed.code,
            });
        }

        const run = await this.openRun(inquiry);

        return {
            inquiryId: inquiry.id,
            runId: run.runId ?? '',
            inquiryStatus: inquiry.status,
            runStatus: run.status,
        };
    }

    /**
     * Прогоны без досье старше порога. now передаётся снаружи, чтобы тест подставил часы.
     */
    async markStale(now: Date): Promise<ResearchRunEntity[]> {
        const afterMs = readMinutes('RESEARCH_STALE_AFTER_MIN', 60) * 60_000;
        const cutoff = now.getTime() - afterMs;
        const rows = await this.runs.find({ payloadSha256: null });
        const stale: ResearchRunEntity[] = [];

        for (const run of rows) {
            if (!OPEN_TRIGGER_STATUSES.has(run.status) || run.dossierStatus) {
                continue;
            }

            const started = run.startedAt ?? run.createdAt;

            if (!started || started.getTime() > cutoff) {
                continue;
            }

            run.status = ResearchRunStatus.STALE;
            run.failureReason = 'Нет досье дольше отведённого времени';
            run.finishedAt = now;
            stale.push(run);
        }

        if (stale.length > 0) {
            await this.runs.getEntityManager().flush();
        }

        for (const run of stale) {
            await this.reportProblem(run);
        }

        return stale;
    }

    private async openRun(inquiry: InquiryEntity): Promise<ResearchRunEntity> {
        const now = new Date();
        const run = this.runs.create({
            inquiry,
            source: TRIGGER_SOURCE,
            status: ResearchRunStatus.PENDING,
            externalRunUrl: null,
            runId: randomUUID(),
            payloadSha256: null,
            startedAt: now,
            triggerAttempts: 0,
            triggerLastError: null,
            failureReason: null,
        });
        const em = this.inquiries.getEntityManager();

        inquiry.status = InquiryStatus.RESEARCHING;
        em.persist(run);
        em.persist(inquiry);
        await em.flush();

        const url = (process.env.RESEARCH_TRIGGER_URL ?? '').trim();

        if (!url) {
            const warning = 'RESEARCH_TRIGGER_URL не задан, заявка остаётся в RESEARCHING';

            Logger.warn(warning, Logger.statuses.WARNING, { data: { inquiryId: inquiry.id, runId: run.runId } });
            run.triggerLastError = warning;
            await em.flush();

            return run;
        }

        const body = await this.payload(inquiry, run.runId ?? '', now);
        const secret = (process.env.RESEARCH_TRIGGER_SECRET ?? '').trim();
        const maxAttempts = readInt('RESEARCH_TRIGGER_MAX_ATTEMPTS', 3);
        const delayMs = readInt('RESEARCH_TRIGGER_RETRY_DELAY_MS', 250);

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const result = this.trigger
                ? await this.trigger.send(url, secret, body)
                : { ok: false, status: null, error: 'Триггер не подключён' };

            run.triggerAttempts = attempt;
            run.triggerLastError = result.error;

            if (result.ok) {
                run.status = ResearchRunStatus.RUNNING;
                run.failureReason = null;
                run.triggerLastError = null;
                await em.flush();

                return run;
            }

            const retryable = result.status === null || result.status >= 500;

            run.failureReason = result.error;
            await em.flush();

            if (!retryable || attempt === maxAttempts) {
                run.status = ResearchRunStatus.FAILED_TO_START;
                await em.flush();
                await this.reportProblem(run);

                return run;
            }

            await sleep(delayMs * attempt);
        }

        run.status = ResearchRunStatus.FAILED_TO_START;
        await em.flush();
        await this.reportProblem(run);

        return run;
    }

    private async reportProblem(run: ResearchRunEntity): Promise<void> {
        if (!this.handoff) {
            return;
        }

        try {
            await this.handoff.onRunProblem(run);
        } catch (error) {
            Logger.error('Уведомление о сбое ресерча не ушло', Logger.statuses.FAIL, {
                data: { message: error instanceof Error ? error.message : String(error), runId: run.runId },
            });
        }
    }

    private async payload(inquiry: InquiryEntity, runId: string, now: Date): Promise<ResearchTriggerBody> {
        const category = inquiry.category;
        const storedAnswers = await this.answers.find({ inquiry: inquiry.id });
        const siteRows = category ? await this.sites.find({ category: category.id, isActive: true }) : [];

        return {
            type: 'finder.research.requested',
            inquiry_id: inquiry.id,
            run_id: runId,
            requested_at: now.toISOString(),
            category_code: category?.code ?? '',
            category_name: category?.name ?? '',
            pack_code: inquiry.questionPack?.code ?? null,
            raw_text: inquiry.rawText,
            answers: storedAnswers.map((answer) => ({
                code: answer.categoryQuestion?.code ?? null,
                prompt: answer.categoryQuestion?.prompt ?? '',
                value: answer.valueText ?? (answer.valueJson === undefined ? '' : JSON.stringify(answer.valueJson)),
            })),
            sites: siteRows
                .filter((site) => site.isActive !== false)
                .sort((left, right) => left.priority - right.priority)
                .map((site) => toSite(site)),
            ingest_url: ingestUrl(),
        };
    }
}

function toSite(site: CategorySiteEntity): ResearchTriggerBody['sites'][number] {
    return {
        name: site.name,
        role: site.siteRole,
        priority: site.priority,
        requires_login: site.requiresLogin,
        query_template: site.queryTemplate ?? null,
    };
}

function ingestUrl(): string {
    const base = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.APP_PORT || '8080'}`).replace(
        /\/$/,
        '',
    );

    return `${base}/research/ingest`;
}

function readMinutes(name: string, fallback: number): number {
    return readInt(name, fallback);
}

function readInt(name: string, fallback: number): number {
    const raw = process.env[name];

    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
        return fallback;
    }

    return Math.floor(value);
}

function sleep(ms: number): Promise<void> {
    if (ms <= 0) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
