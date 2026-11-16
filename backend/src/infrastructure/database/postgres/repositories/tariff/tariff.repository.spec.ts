import 'reflect-metadata';
import { getRepositoryToken } from '@mikro-orm/nestjs';

import { DailyUsageEntity } from '../../../../../domain/entities/tariff/daily-usage.entity';
import { PlanEntity } from '../../../../../domain/entities/tariff/plan.entity';
import { DailyUsageRepositoryImpl } from './daily-usage.repository.impl';
import { PlanRepositoryImpl } from './plan.repository.impl';

/**
 * Прод регистрирует эти классы через useClass.
 * Без @InjectRepository Nest вызывает конструктор без аргументов, this.em пустой,
 * и findByCode падает: Cannot read properties of undefined (reading 'findOne').
 */
describe('репозитории тарифа получают EntityManager', () => {
    it('PlanRepositoryImpl просит у Nest репозиторий PlanEntity и вызывает его findOne', async () => {
        const deps = Reflect.getMetadata('self:paramtypes', PlanRepositoryImpl) as
            | { index: number; param: unknown }[]
            | undefined;
        const plan = Object.assign(new PlanEntity(), {
            code: 'free',
            title: 'Бесплатный',
            dailyResearchLimit: 3,
        });
        const findOne = jest.fn().mockResolvedValue(plan);
        const plans = new PlanRepositoryImpl({ getEntityManager: () => ({ findOne }) } as never);

        expect(deps).toEqual([{ index: 0, param: getRepositoryToken(PlanEntity) }]);
        await expect(plans.findByCode('free')).resolves.toBe(plan);
        expect(findOne).toHaveBeenCalledWith(PlanEntity, { code: 'free' });
    });

    it('DailyUsageRepositoryImpl просит у Nest репозиторий DailyUsageEntity и вызывает его findOne', async () => {
        const deps = Reflect.getMetadata('self:paramtypes', DailyUsageRepositoryImpl) as
            | { index: number; param: unknown }[]
            | undefined;
        const usage = Object.assign(new DailyUsageEntity(), { usageDate: '2026-11-16', researchCount: 0 });
        const findOne = jest.fn().mockResolvedValue(usage);
        const dailyUsage = new DailyUsageRepositoryImpl({ getEntityManager: () => ({ findOne }) } as never);

        expect(deps).toEqual([{ index: 0, param: getRepositoryToken(DailyUsageEntity) }]);
        await expect(dailyUsage.findOrCreate('user-1', '2026-11-16')).resolves.toBe(usage);
        expect(findOne).toHaveBeenCalledWith(DailyUsageEntity, { user: 'user-1', usageDate: '2026-11-16' });
    });
});
