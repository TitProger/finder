import { Migration } from '@mikro-orm/migrations';

/**
 * Очередь ресерча на Postgres, QUEUED_RESEARCH и уникальный payload_sha256.
 */
export class Migration20261123160000_ResearchQueue extends Migration {
    override async up(): Promise<void> {
        this.addSql(`ALTER TYPE "inquiry_status" ADD VALUE IF NOT EXISTS 'QUEUED_RESEARCH';`);

        this.addSql(`create type "research_task_status" as enum ('PENDING', 'CLAIMED', 'COMPLETED', 'FAILED');`);

        this.addSql(`
            create table "research_task" (
                "id" uuid not null,
                "created_at" timestamptz not null default now(),
                "updated_at" timestamptz null,
                "inquiry_id" uuid not null,
                "research_run_id" uuid null,
                "status" "research_task_status" not null default 'PENDING',
                "attempts" int not null default 0,
                "last_error" text null,
                "claimed_at" timestamptz null,
                "finished_at" timestamptz null,
                constraint "research_task_pkey" primary key ("id")
            );
        `);

        this.addSql(
            `alter table "research_task" add constraint "research_task_inquiry_id_foreign" foreign key ("inquiry_id") references "inquiry" ("id") on update cascade on delete cascade;`,
        );
        this.addSql(
            `alter table "research_task" add constraint "research_task_research_run_id_foreign" foreign key ("research_run_id") references "research_run" ("id") on update cascade on delete set null;`,
        );
        this.addSql(`create index "research_task_status_created_at_index" on "research_task" ("status", "created_at");`);
        this.addSql(`create index "research_task_inquiry_id_index" on "research_task" ("inquiry_id");`);

        this.addSql(`
            create unique index "research_run_payload_sha256_unique"
            on "research_run" ("payload_sha256")
            where "payload_sha256" is not null;
        `);
    }

    override async down(): Promise<void> {
        this.addSql(`drop index if exists "research_run_payload_sha256_unique";`);
        this.addSql(`drop table if exists "research_task";`);
        this.addSql(`drop type if exists "research_task_status";`);
    }
}
