import { Migration } from '@mikro-orm/migrations';

/**
 * Убирает неиспользуемые колонки и снимок рынка.
 * down восстанавливает таблицу и колонки учётки. Колонки похожести возвращаются только если расширение доступно,
 * иначе down не падает на обычном postgres:17.
 */
export class Migration20261114200000_DropUnusedAuthAndVectors extends Migration {
    override async up(): Promise<void> {
        this.addSql(`alter table "category" drop column if exists "embedding";`);
        this.addSql(`alter table "category_phrase" drop column if exists "embedding";`);
        this.addSql(`alter table "canonical_product" drop column if exists "embedding";`);
        this.addSql(`drop extension if exists vector;`);
        this.addSql(`drop table if exists "market_snapshot" cascade;`);
        this.addSql(`alter table "app_user" drop constraint if exists "app_user_login_unique";`);
        this.addSql(`alter table "app_user" drop column if exists "login";`);
        this.addSql(`alter table "app_user" drop column if exists "password_hash";`);
    }

    override async down(): Promise<void> {
        this.addSql(`alter table "app_user" add column if not exists "login" varchar(100) null;`);
        this.addSql(`alter table "app_user" add column if not exists "password_hash" varchar(255) null;`);
        this.addSql(`
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_user_login_unique') then
    alter table "app_user" add constraint "app_user_login_unique" unique ("login");
  end if;
end $$;`);
        this.addSql(`
create table if not exists "market_snapshot" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "research_run_id" uuid null,
  "inquiry_id" uuid null,
  "canonical_product_id" uuid null,
  "layer" "market_price_layer" not null,
  "source" varchar(255) not null,
  "median_price" numeric null,
  "currency" varchar(3) null,
  "spread_low" numeric null,
  "spread_high" numeric null,
  "sample_points" jsonb null,
  "captured_at" timestamptz not null,
  "expires_at" timestamptz not null,
  constraint "market_snapshot_pkey" primary key ("id")
);`);
        this.addSql(
            `create index if not exists "market_snapshot_canonical_product_id_layer_captured_at_index" on "market_snapshot" ("canonical_product_id", "layer", "captured_at");`,
        );
        this.addSql(
            `create index if not exists "market_snapshot_research_run_id_index" on "market_snapshot" ("research_run_id");`,
        );
        this.addSql(`
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'market_snapshot_research_run_id_foreign') then
    alter table "market_snapshot" add constraint "market_snapshot_research_run_id_foreign" foreign key ("research_run_id") references "research_run" ("id") on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'market_snapshot_inquiry_id_foreign') then
    alter table "market_snapshot" add constraint "market_snapshot_inquiry_id_foreign" foreign key ("inquiry_id") references "inquiry" ("id") on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'market_snapshot_canonical_product_id_foreign') then
    alter table "market_snapshot" add constraint "market_snapshot_canonical_product_id_foreign" foreign key ("canonical_product_id") references "canonical_product" ("id") on update cascade on delete set null;
  end if;
end $$;`);
        this.addSql(`
do $$
begin
  create extension if not exists vector;
  alter table "category" add column if not exists "embedding" vector(1536);
  alter table "category_phrase" add column if not exists "embedding" vector(1536);
  alter table "canonical_product" add column if not exists "embedding" vector(1536);
exception
  when others then
    raise notice 'extension vector is unavailable; embedding columns stay dropped';
end $$;`);
    }
}
