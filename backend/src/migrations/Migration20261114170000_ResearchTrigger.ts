import { Migration } from '@mikro-orm/migrations';

/**
 * Статусы запуска и зависшего прогона, счётчик попыток webhook.
 */
export class Migration20261114170000_ResearchTrigger extends Migration {
    override async up(): Promise<void> {
        this.addSql(`ALTER TYPE "research_run_status" ADD VALUE IF NOT EXISTS 'FAILED_TO_START';`);
        this.addSql(`ALTER TYPE "research_run_status" ADD VALUE IF NOT EXISTS 'STALE';`);
        this.addSql(
            `alter table "research_run" add column "trigger_attempts" int not null default 0;`,
        );
        this.addSql(`alter table "research_run" add column "trigger_last_error" text null;`);
    }

    override async down(): Promise<void> {
        this.addSql(`alter table "research_run" drop column if exists "trigger_last_error";`);
        this.addSql(`alter table "research_run" drop column if exists "trigger_attempts";`);
    }
}
