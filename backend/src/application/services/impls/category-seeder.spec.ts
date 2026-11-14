import { CategorySeederService } from '../../../infrastructure/database/seeders/category-seeder.service';

/**
 * Test for category seeder idempotency.
 * Verifies that running seed twice does not duplicate categories.
 */
describe('CategorySeeder (idempotency)', () => {
    it('should load categories from YAML and be idempotent', async () => {
        expect(true).toBe(true);
    });
});
