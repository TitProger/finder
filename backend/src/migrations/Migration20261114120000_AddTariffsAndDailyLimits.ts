import { Migration } from '@mikro-orm/migrations';

/**
 * Добавляет тарифы (план) и дневные лимиты использования.
 * Новая таблица plan для хранения тарифных планов (free, unlimited).
 * Новая таблица daily_usage для подсчёта запросов на ресерч за день.
 * Добавляет колонку plan_code в app_user.
 */
export class Migration20261114120000_AddTariffsAndDailyLimits extends Migration {
    override async up(): Promise<void> {
        // Создаём таблицу plan
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

        // Создаём таблицу daily_usage
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

        // Добавляем колонку plan_code в app_user
        this.addSql(`alter table "app_user" add column "plan_code" varchar(50) not null default 'free';`);
        this.addSql(`create index "app_user_plan_code_index" on "app_user" ("plan_code");`);

        // Сидим начальные тарифы
        this.addSql(`
            insert into "plan" ("code", "title", "daily_research_limit")
            values
                ('free', 'Бесплатный', 3),
                ('unlimited', 'Безлимитный', null)
            on conflict do nothing;
        `);
    }

    override async down(): Promise<void> {
        // Удаляем колонку plan_code из app_user
        this.addSql(`drop index if exists "app_user_plan_code_index";`);
        this.addSql(`alter table "app_user" drop column if exists "plan_code";`);

        // Удаляем таблицу daily_usage
        this.addSql(`drop index if exists "daily_usage_user_id_usage_date_unique";`);
        this.addSql(`drop index if exists "daily_usage_user_id_index";`);
        this.addSql(`alter table "daily_usage" drop constraint if exists "daily_usage_user_id_foreign";`);
        this.addSql(`drop table if exists "daily_usage";`);

        // Удаляем таблицу plan
        this.addSql(`drop index if exists "plan_code_unique";`);
        this.addSql(`drop table if exists "plan";`);
    }
}
