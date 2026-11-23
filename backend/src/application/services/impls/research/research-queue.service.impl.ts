import { Inject, Injectable } from '@nestjs/common';

import { Logger } from '../../../../common/logger/logger';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ResearchTaskEntity } from '../../../../domain/entities/market/research-task.entity';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { ResearchTaskStatus } from '../../../../domain/enums/research-task-status.enum';
import { ResearchTaskRepository } from '../../../../domain/repositories/market/research-task.repository';
import { REPOSITORY_TOKENS } from '../../../../domain/repositories/repository.tokens';
import { ResearchQueueService } from '../../contracts/research/research-queue.service';
import { RESEARCH_LAUNCH_SERVICE, ResearchLaunchService } from './research-launch.service';

const OPEN_TASK = new Set<ResearchTaskStatus>([ResearchTaskStatus.PENDING, ResearchTaskStatus.CLAIMED]);

/**
 * Очередь ресерча только на Postgres. Триггер — порт асинхронного моста:
 * 2xx значит «запуск принят», не «досье готово».
 */
@Injectable()
export class ResearchQueueServiceImpl implements ResearchQueueService {
    constructor(
        @Inject(REPOSITORY_TOKENS.RESEARCH_TASK_REPOSITORY)
        private readonly tasks: ResearchTaskRepository,
        @Inject(RESEARCH_LAUNCH_SERVICE)
        private readonly launch: ResearchLaunchService,
    ) {}

    async enqueue(inquiry: InquiryEntity): Promise<ResearchTaskEntity> {
        const existing = await this.tasks.find(
            { inquiry: inquiry.id },
            { orderBy: { createdAt: 'DESC' }, limit: 5 },
        );
        const open = existing.find((task) => OPEN_TASK.has(task.status));

        if (open) {
            return open;
        }

        const task = this.tasks.create({
            inquiry,
            researchRun: null,
            status: ResearchTaskStatus.PENDING,
            attempts: 0,
            lastError: null,
            claimedAt: null,
            finishedAt: null,
        });
        const em = this.tasks.getEntityManager();

        inquiry.status = InquiryStatus.QUEUED_RESEARCH;
        em.persist(task);
        em.persist(inquiry);
        await em.flush();

        return task;
    }

    async processNext(now: Date = new Date()): Promise<ResearchTaskEntity | null> {
        const pending = await this.tasks.find(
            { status: ResearchTaskStatus.PENDING },
            { orderBy: { createdAt: 'ASC' }, limit: 1, populate: ['inquiry', 'inquiry.category', 'inquiry.questionPack'] },
        );
        const task = pending[0];

        if (!task) {
            return null;
        }

        const inquiry = task.inquiry;
        const em = this.tasks.getEntityManager();

        task.status = ResearchTaskStatus.CLAIMED;
        task.claimedAt = now;
        task.attempts += 1;
        task.lastError = null;
        em.persist(task);
        await em.flush();

        try {
            const run = await this.launch.startForInquiry(inquiry);

            task.researchRun = run;

            if (run.status === ResearchRunStatus.FAILED_TO_START) {
                task.status = ResearchTaskStatus.FAILED;
                task.lastError = run.failureReason ?? run.triggerLastError ?? 'Не удалось стартовать ресерч';
                task.finishedAt = now;
            } else {
                task.status = ResearchTaskStatus.COMPLETED;
                task.finishedAt = now;
            }

            em.persist(task);
            await em.flush();

            return task;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            Logger.error('Очередь ресерча не обработала задачу', Logger.statuses.FAIL, {
                data: { taskId: task.id, inquiryId: inquiry.id, message },
            });

            task.status = ResearchTaskStatus.FAILED;
            task.lastError = message;
            task.finishedAt = now;
            em.persist(task);
            await em.flush();

            return task;
        }
    }
}
