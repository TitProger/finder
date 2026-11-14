import { Migration } from '@mikro-orm/migrations';

/**
 * Add LIMIT_EXCEEDED status to inquiry_status enum.
 * Distinct from AWAITING_CATEGORY to avoid triggering admin category selection card.
 */
export class Migration20261114140000_AddLimitExceededStatus extends Migration {
    override async up(): Promise<void> {
        this.addSql(`ALTER TYPE "inquiry_status" ADD VALUE 'LIMIT_EXCEEDED';`);
    }

    override async down(): Promise<void> {
        // Enum values cannot be removed in PostgreSQL without recreating the enum
        // This is intentionally left as a no-op for safety
    }
}
