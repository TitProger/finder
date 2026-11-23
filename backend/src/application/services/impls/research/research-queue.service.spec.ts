import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { CategoryEntity } from '../../../../domain/entities/category/category.entity';
import { InquiryEntity } from '../../../../domain/entities/inquiry/inquiry.entity';
import { ResearchRunEntity } from '../../../../domain/entities/market/research-run.entity';
import { ResearchTaskEntity } from '../../../../domain/entities/market/research-task.entity';
import { CategoryStatus } from '../../../../domain/enums/category-status.enum';
import { InquiryStatus } from '../../../../domain/enums/inquiry-status.enum';
import { ResearchRunStatus } from '../../../../domain/enums/research-run-status.enum';
import { ResearchTaskStatus } from '../../../../domain/enums/research-task-status.enum';
import { InquiryRepository } from '../../../../domain/repositories/inquiry/inquiry.repository';
import { ResearchRunRepository } from '../../../../domain/repositories/market/research-run.repository';
import { ResearchTaskRepository } from '../../../../domain/repositories/market/research-task.repository';
import { ResearchTriggerPort } from '../../../ports/research-trigger.port';
import { ResearchLaunchService } from './research-launch.service';
import { ResearchQueueServiceImpl } from './research-queue.service.impl';

type Stored = { id: string };

function matches(entity: object, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, expected]) => {
        const actual = (entity as Record<string, unknown>)[key];

        if (actual && typeof actual === 'object' && 'id' in actual) {
            const expectedId =
                typeof expected === 'string' ? expected : (expected as { id?: string } | null)?.id;

            return (actual as { id: string }).id === expectedId;
        }

        return actual === expected;
    });
}

function stamp<T extends object>(entity: T, data: object): T {
    Object.assign(entity, data);
    const dated = entity as T & { createdAt?: Date; updatedAt?: Date | null };

    if (!dated.createdAt) {
        dated.createdAt = new Date();
    }

    if (dated.updatedAt === undefined) {
        dated.updatedAt = null;
    }

    return entity;
}

function buildHarness(triggerOk: boolean) {
    const inquiries: InquiryEntity[] = [];
    const runs: ResearchRunEntity[] = [];
    const tasks: ResearchTaskEntity[] = [];
    const lists = new Map<object, Stored[]>();
    const em = {
        persist(entity: Stored) {
            const list = lists.get(entity.constructor);

            if (!list) {
                throw new Error(`Нет списка для ${entity.constructor.name}`);
            }

            if (!list.includes(entity)) {
                list.push(entity);
            }

            return em;
        },
        async flush() {
            return undefined;
        },
    };

    function repo<T extends Stored>(Ctor: new () => T, items: T[]) {
        lists.set(Ctor, items);

        return {
            create(data: object) {
                return stamp(new Ctor(), data);
            },
            find(where: Record<string, unknown>, options?: { limit?: number }) {
                const rows = items.filter((item) => matches(item, where));

                return Promise.resolve(options?.limit ? rows.slice(0, options.limit) : rows);
            },
            findOne(where: Record<string, unknown>) {
                return Promise.resolve(items.find((item) => matches(item, where)) ?? null);
            },
            getEntityManager() {
                return em;
            },
        };
    }

    const category = stamp(new CategoryEntity(), {
        code: 'clothing',
        name: 'Одежда',
        description: 'фикстура',
        status: CategoryStatus.ACTIVE,
    });
    const inquiry = stamp(new InquiryEntity(), {
        status: InquiryStatus.COLLECTING_ANSWERS,
        rawText: 'лабораторные халаты',
        photoUrls: [],
        category,
        questionPack: null,
        isPaused: false,
    });
    const inquiriesRepo = repo(InquiryEntity, inquiries);
    const runsRepo = repo(ResearchRunEntity, runs);
    const tasksRepo = repo(ResearchTaskEntity, tasks);
    const trigger: ResearchTriggerPort = {
        async send() {
            return triggerOk
                ? { ok: true, status: 202, error: null }
                : { ok: false, status: 503, error: 'HTTP 503' };
        },
    };
    const answers = {
        find: async () => [],
        getEntityManager: () => em,
    };
    const sites = {
        find: async () => [],
        getEntityManager: () => em,
    };
    const launch = new ResearchLaunchService(
        inquiriesRepo as unknown as InquiryRepository,
        answers as never,
        sites as never,
        runsRepo as unknown as ResearchRunRepository,
        trigger,
    );
    const queue = new ResearchQueueServiceImpl(
        tasksRepo as unknown as ResearchTaskRepository,
        launch,
    );

    em.persist(inquiry);
    process.env.RESEARCH_TRIGGER_URL = 'https://research.fixture/hook';
    process.env.RESEARCH_TRIGGER_SECRET = 'fixture-secret';
    process.env.RESEARCH_TRIGGER_MAX_ATTEMPTS = '1';

    return { queue, inquiry, tasks, runs };
}

describe('ResearchQueueService (фикстуры WP5)', () => {
    afterEach(() => {
        delete process.env.RESEARCH_TRIGGER_URL;
        delete process.env.RESEARCH_TRIGGER_SECRET;
        delete process.env.RESEARCH_TRIGGER_MAX_ATTEMPTS;
    });

    it('ставит задачу в Postgres и не дублирует открытую', async () => {
        const harness = buildHarness(true);

        const first = await harness.queue.enqueue(harness.inquiry);
        const second = await harness.queue.enqueue(harness.inquiry);

        expect(first.id).toBe(second.id);
        expect(harness.tasks).toHaveLength(1);
        expect(harness.inquiry.status).toBe(InquiryStatus.QUEUED_RESEARCH);
        expect(first.status).toBe(ResearchTaskStatus.PENDING);
    });

    it('worker принимает 2xx как старт, не как готовое досье', async () => {
        const harness = buildHarness(true);

        await harness.queue.enqueue(harness.inquiry);
        const processed = await harness.queue.processNext(new Date());

        expect(processed?.status).toBe(ResearchTaskStatus.COMPLETED);
        expect(harness.runs).toHaveLength(1);
        expect(harness.runs[0]?.status).toBe(ResearchRunStatus.RUNNING);
        expect(harness.runs[0]?.payloadSha256).toBeNull();
        expect(harness.inquiry.status).toBe(InquiryStatus.RESEARCHING);
        expect(harness.runs[0]?.runId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(randomUUID()).toBeTruthy();
    });

    it('сбой триггера помечает задачу FAILED без живого Grok', async () => {
        const harness = buildHarness(false);

        await harness.queue.enqueue(harness.inquiry);
        const processed = await harness.queue.processNext(new Date());

        expect(processed?.status).toBe(ResearchTaskStatus.FAILED);
        expect(harness.runs[0]?.status).toBe(ResearchRunStatus.FAILED_TO_START);
        expect(processed?.lastError).toContain('HTTP 503');
    });
});
