import { Migration } from '@mikro-orm/migrations';

/**
 * Последняя ошибка уведомления менеджера. Приём досье из-за неё не откатывается.
 */
export class Migration20261114180000_ManagerNotify extends Migration {
    override async up(): Promise<void> {
        this.addSql(`alter table "research_run" add column "notify_last_error" text null;`);
    }

    override async down(): Promise<void> {
        this.addSql(`alter table "research_run" drop column if exists "notify_last_error";`);
    }
}
