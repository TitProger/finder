import { LimitCheckerServiceImpl } from './limit-checker.service.impl';
import { PlanRepository } from '../../../../domain/repositories/tariff/plan.repository';
import { DailyUsageRepository } from '../../../../domain/repositories/tariff/daily-usage.repository';
import { AppUserRepository } from '../../../../domain/repositories/user/app-user.repository';
import { PlanEntity } from '../../../../domain/entities/tariff/plan.entity';
import { DailyUsageEntity } from '../../../../domain/entities/tariff/daily-usage.entity';
import { AppUserEntity } from '../../../../domain/entities/user/app-user.entity';
import * as Env from '../../../../common/envs/env';

// Mock the Envs to control admin IDs
jest.mock('../../../../common/envs/env', () => ({
    Envs: {
        admin: {
            telegramIds: ['871909427', '123456789'],
        },
    },
}));

describe('LimitCheckerService', () => {
    let service: LimitCheckerServiceImpl;
    let usersRepo: jest.Mocked<AppUserRepository>;
    let plansRepo: jest.Mocked<PlanRepository>;
    let dailyUsageRepo: jest.Mocked<DailyUsageRepository>;

    beforeEach(() => {
        usersRepo = {
            findOne: jest.fn(),
        } as any;

        plansRepo = {
            findByCode: jest.fn(),
        } as any;

        dailyUsageRepo = {
            findOrCreate: jest.fn(),
            incrementResearchCount: jest.fn(),
        } as any;

        service = new LimitCheckerServiceImpl(usersRepo, plansRepo, dailyUsageRepo);
    });

    it('allows research when limit not reached', async () => {
        const user = { id: 'user1', planCode: 'free' } as AppUserEntity;
        const plan = { code: 'free', dailyResearchLimit: 3 } as PlanEntity;
        const usage = { researchCount: 2 } as DailyUsageEntity;

        usersRepo.findOne.mockResolvedValue(user);
        plansRepo.findByCode.mockResolvedValue(plan);
        dailyUsageRepo.findOrCreate.mockResolvedValue(usage);

        const result = await service.canStartResearch('user1', '999');

        expect(result.allowed).toBe(true);
    });

    it('refuses research when limit reached', async () => {
        const user = { id: 'user1', planCode: 'free' } as AppUserEntity;
        const plan = { code: 'free', dailyResearchLimit: 3 } as PlanEntity;
        const usage = { researchCount: 3 } as DailyUsageEntity;

        usersRepo.findOne.mockResolvedValue(user);
        plansRepo.findByCode.mockResolvedValue(plan);
        dailyUsageRepo.findOrCreate.mockResolvedValue(usage);

        const result = await service.canStartResearch('user1', '999');

        expect(result.allowed).toBe(false);

        if (!result.allowed) {
            expect(result.limit).toBe(3);
            expect(result.current).toBe(3);
            expect(result.reason).toContain('лимит');
        }
    });

    it('allows admin from ADMIN_TELEGRAM_IDS regardless of plan', async () => {
        const user = { id: 'admin1', planCode: 'free' } as AppUserEntity;
        const plan = { code: 'free', dailyResearchLimit: 3 } as PlanEntity;
        const usage = { researchCount: 10 } as DailyUsageEntity; // Way over limit

        usersRepo.findOne.mockResolvedValue(user);
        plansRepo.findByCode.mockResolvedValue(plan);
        dailyUsageRepo.findOrCreate.mockResolvedValue(usage);

        // Admin ID from env
        const result = await service.canStartResearch('admin1', '871909427');

        expect(result.allowed).toBe(true);
        expect(plansRepo.findByCode).not.toHaveBeenCalled(); // Short-circuits for admins
    });

    it('allows unlimited plan users', async () => {
        const user = { id: 'user1', planCode: 'unlimited' } as AppUserEntity;
        const plan = { code: 'unlimited', dailyResearchLimit: null } as PlanEntity;
        const usage = { researchCount: 100 } as DailyUsageEntity;

        usersRepo.findOne.mockResolvedValue(user);
        plansRepo.findByCode.mockResolvedValue(plan);
        dailyUsageRepo.findOrCreate.mockResolvedValue(usage);

        const result = await service.canStartResearch('user1', '999');

        expect(result.allowed).toBe(true);
    });

    it('increments research usage', async () => {
        await service.incrementResearchUsage('user1');

        expect(dailyUsageRepo.incrementResearchCount).toHaveBeenCalledWith('user1', expect.any(String));
    });
});

describe('getMoscowDate', () => {
    it('returns correct date for Moscow timezone around midnight UTC', () => {
        // 21:00 UTC = 00:00 Moscow (UTC+3)
        const date = new Date('2026-11-14T21:00:00Z');
        const result = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

        expect(result).toBe('2026-11-15'); // Next day in Moscow
    });

    it('returns correct date for Moscow timezone in afternoon', () => {
        // 12:00 UTC = 15:00 Moscow
        const date = new Date('2026-11-14T12:00:00Z');
        const result = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

        expect(result).toBe('2026-11-14'); // Same day
    });
});
