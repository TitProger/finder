import { Migration } from '@mikro-orm/migrations';

/**
 * Убирает telegram_user_id, тарифы free/unlimited и статус LIMIT_EXCEEDED.
 * inquiry_status пересоздаётся и сохраняет QUEUED_RESEARCH.
 */
export class Migration20261123200000_DropTelegramAndTariffs extends Migration {
    override async up(): Promise<void> {
        this.addSql(`update "inquiry" set "status" = 'CLOSED' where "status"::text = 'LIMIT_EXCEEDED';`);

        this.addSql(`drop table if exists "daily_usage" cascade;`);
        this.addSql(`drop table if exists "plan" cascade;`);

        this.addSql(`drop index if exists "app_user_plan_code_index";`);
        this.addSql(`alter table "app_user" drop column if exists "plan_code";`);

        this.addSql(`alter table "app_user" drop constraint if exists "app_user_telegram_user_id_unique";`);
        this.addSql(`alter table "app_user" drop column if exists "telegram_user_id";`);

        this.addSql(`alter type "inquiry_status" rename to "inquiry_status_old";`);
        this.addSql(`
            create type "inquiry_status" as enum (
                'DRAFT',
                'AWAITING_CATEGORY',
                'COLLECTING_ANSWERS',
                'QUEUED_RESEARCH',
                'SERVED_FROM_DATABASE',
                'RESEARCHING',
                'DOSSIER_WITH_ADMIN',
                'CLOSED'
            );
        `);
        this.addSql(`alter table "inquiry" alter column "status" drop default;`);
        this.addSql(
            `alter table "inquiry" alter column "status" type "inquiry_status" using "status"::text::"inquiry_status";`,
        );
        this.addSql(`alter table "inquiry" alter column "status" set default 'DRAFT';`);
        this.addSql(`drop type "inquiry_status_old";`);
    }

    override async down(): Promise<void> {
        this.addSql(`alter type "inquiry_status" rename to "inquiry_status_new";`);
        this.addSql(`
            create type "inquiry_status" as enum (
                'DRAFT',
                'AWAITING_CATEGORY',
                'COLLECTING_ANSWERS',
                'QUEUED_RESEARCH',
                'SERVED_FROM_DATABASE',
                'RESEARCHING',
                'DOSSIER_WITH_ADMIN',
                'LIMIT_EXCEEDED',
                'CLOSED'
            );
        `);
        this.addSql(`alter table "inquiry" alter column "status" drop default;`);
        this.addSql(
            `alter table "inquiry" alter column "status" type "inquiry_status" using "status"::text::"inquiry_status";`,
        );
        this.addSql(`alter table "inquiry" alter column "status" set default 'DRAFT';`);
        this.addSql(`drop type "inquiry_status_new";`);

        this.addSql(`alter table "app_user" add column "telegram_user_id" bigint null;`);
        this.addSql(
            `alter table "app_user" add constraint "app_user_telegram_user_id_unique" unique ("telegram_user_id");`,
        );
        this.addSql(`alter table "app_user" add column "plan_code" varchar(50) not null default 'free';`);
        this.addSql(`create index "app_user_plan_code_index" on "app_user" ("plan_code");`);

        this.addSql(`
            create table "plan" (
                "id" uuid not null default gen_random_uuid(),
                "code" varchar(50) not null,
                "title" varchar(255) not null,
                "daily_research_limit" int null,
                "created_at" timestamptz not null default now(),
                "updated_at" timestamptz not null default now(),
                constraint "plan_pkey" primary key ("id")
            );
        `);
        this.addSql(`create unique index "plan_code_unique" on "plan" ("code");`);
        this.addSql(`
            create table "daily_usage" (
                "id" uuid not null default gen_random_uuid(),
                "user_id" uuid not null,
                "usage_date" date not null,
                "research_count" int not null default 0,
                "created_at" timestamptz not null default now(),
                "updated_at" timestamptz not null default now(),
                constraint "daily_usage_pkey" primary key ("id")
            );
        `);
        this.addSql(
            `alter table "daily_usage" add constraint "daily_usage_user_id_foreign" foreign key ("user_id") references "app_user" ("id") on update cascade on delete cascade;`,
        );
        this.addSql(`create index "daily_usage_user_id_index" on "daily_usage" ("user_id");`);
        this.addSql(
            `create unique index "daily_usage_user_id_usage_date_unique" on "daily_usage" ("user_id", "usage_date");`,
        );
    }
}
