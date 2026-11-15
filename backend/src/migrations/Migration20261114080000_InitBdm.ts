import { Migration } from '@mikro-orm/migrations';

/**
 * BDM Finder: enums, таблицы и FK из schema.dbml.
 * Обычный postgres:17, без расширений.
 */
export class Migration20261114080000_InitBdm extends Migration {
    override async up(): Promise<void> {
        this.addSql(`create type "user_role" as enum ('ADMIN', 'CLIENT');`);
        this.addSql(`create type "category_status" as enum ('ACTIVE', 'ARCHIVED');`);
        this.addSql(
            `create type "question_answer_type" as enum ('TEXT', 'NUMBER', 'BOOLEAN', 'SINGLE_CHOICE', 'MULTI_CHOICE');`,
        );
        this.addSql(
            `create type "site_role" as enum ('FACTORY_CONTACT', 'CHINA_OPEN_PRICE', 'RUSSIA_RETAIL', 'RUSSIA_WHOLESALE');`,
        );
        this.addSql(
            `create type "inquiry_status" as enum ('DRAFT', 'AWAITING_CATEGORY', 'COLLECTING_ANSWERS', 'SERVED_FROM_DATABASE', 'RESEARCHING', 'DOSSIER_WITH_ADMIN', 'CLOSED');`,
        );
        this.addSql(
            `create type "supplier_role" as enum ('DIRECT_FACTORY', 'FACTORY_WITH_EXPORTER', 'TRADER', 'UNVERIFIED', 'DEALER_OR_LIST_PRICE');`,
        );
        this.addSql(
            `create type "market_price_layer" as enum ('RUSSIA_RETAIL', 'RUSSIA_WHOLESALE', 'CHINA_OPEN');`,
        );
        this.addSql(
            `create type "company_registry_status" as enum ('ACTIVE', 'REVOKED', 'UNKNOWN', 'OTHER');`,
        );
        this.addSql(
            `create type "research_run_status" as enum ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');`,
        );
        this.addSql(
            `create type "contact_channel" as enum ('PHONE', 'EMAIL', 'WECHAT', 'TELEGRAM', 'OTHER');`,
        );

        this.addSql(`
create table "app_user" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "role" "user_role" not null,
  "telegram_user_id" bigint null,
  "login" varchar(100) null,
  "password_hash" varchar(255) null,
  "display_name" varchar(255) null,
  "is_active" boolean not null default true,
  constraint "app_user_pkey" primary key ("id")
);`);
        this.addSql(`alter table "app_user" add constraint "app_user_telegram_user_id_unique" unique ("telegram_user_id");`);
        this.addSql(`alter table "app_user" add constraint "app_user_login_unique" unique ("login");`);

        this.addSql(`
create table "category" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "name" varchar(255) not null,
  "description" text not null,
  "status" "category_status" not null default 'ACTIVE',
  constraint "category_pkey" primary key ("id")
);`);
        this.addSql(`alter table "category" add constraint "category_name_unique" unique ("name");`);

        this.addSql(`
create table "category_phrase" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "category_id" uuid not null,
  "phrase" text not null,
  constraint "category_phrase_pkey" primary key ("id")
);`);
        this.addSql(
            `alter table "category_phrase" add constraint "category_phrase_category_id_phrase_unique" unique ("category_id", "phrase");`,
        );
        this.addSql(
            `alter table "category_phrase" add constraint "category_phrase_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete cascade;`,
        );

        this.addSql(`
create table "question_pack" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "category_id" uuid not null,
  "code" varchar(64) not null,
  "title" varchar(255) not null,
  "description" text null,
  "sort_order" int not null default 0,
  "is_active" boolean not null default true,
  constraint "question_pack_pkey" primary key ("id")
);`);
        this.addSql(
            `alter table "question_pack" add constraint "question_pack_category_id_code_unique" unique ("category_id", "code");`,
        );
        this.addSql(
            `alter table "question_pack" add constraint "question_pack_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete cascade;`,
        );

        this.addSql(`
create table "category_question" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "category_id" uuid not null,
  "question_pack_id" uuid null,
  "prompt" text not null,
  "answer_type" "question_answer_type" not null,
  "choices" jsonb null,
  "is_required" boolean not null default true,
  "sort_order" int not null default 0,
  constraint "category_question_pkey" primary key ("id")
);`);
        this.addSql(
            `create index "category_question_category_id_question_pack_id_sort_order_index" on "category_question" ("category_id", "question_pack_id", "sort_order");`,
        );
        this.addSql(
            `alter table "category_question" add constraint "category_question_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete cascade;`,
        );
        this.addSql(
            `alter table "category_question" add constraint "category_question_question_pack_id_foreign" foreign key ("question_pack_id") references "question_pack" ("id") on update cascade on delete cascade;`,
        );

        this.addSql(`
create table "category_site" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "category_id" uuid not null,
  "site_role" "site_role" not null,
  "name" varchar(255) not null,
  "base_url" varchar(2048) null,
  "priority" int not null default 100,
  "requires_login" boolean not null default false,
  "query_template" text null,
  "exclude_note" text null,
  "is_active" boolean not null default true,
  constraint "category_site_pkey" primary key ("id")
);`);
        this.addSql(
            `create index "category_site_category_id_site_role_priority_index" on "category_site" ("category_id", "site_role", "priority");`,
        );
        this.addSql(
            `alter table "category_site" add constraint "category_site_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete cascade;`,
        );

        this.addSql(`
create table "canonical_product" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "category_id" uuid not null,
  "name_ru" varchar(512) not null,
  "name_zh" varchar(512) null,
  "attributes" jsonb null,
  constraint "canonical_product_pkey" primary key ("id")
);`);
        this.addSql(
            `create index "canonical_product_category_id_name_ru_index" on "canonical_product" ("category_id", "name_ru");`,
        );
        this.addSql(
            `alter table "canonical_product" add constraint "canonical_product_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete restrict;`,
        );

        this.addSql(`
create table "company" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "legal_name_zh" varchar(512) not null,
  "unified_social_credit_code" varchar(32) null,
  "registry_status" "company_registry_status" not null default 'UNKNOWN',
  "address" text null,
  "business_scope" text null,
  "insured_employee_count" int null,
  constraint "company_pkey" primary key ("id")
);`);
        this.addSql(
            `alter table "company" add constraint "company_unified_social_credit_code_unique" unique ("unified_social_credit_code");`,
        );

        this.addSql(`
create table "storefront" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "company_id" uuid null,
  "platform_name" varchar(128) not null,
  "seller_external_id" varchar(255) null,
  "storefront_url" varchar(2048) not null,
  "factory_labels" jsonb null,
  "city" varchar(255) null,
  constraint "storefront_pkey" primary key ("id")
);`);
        this.addSql(
            `create unique index "storefront_platform_seller_unique" on "storefront" ("platform_name", "seller_external_id") where "seller_external_id" is not null;`,
        );
        this.addSql(
            `alter table "storefront" add constraint "storefront_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
        );

        this.addSql(`
create table "inquiry" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "client_user_id" uuid not null,
  "status" "inquiry_status" not null default 'DRAFT',
  "raw_text" text not null,
  "photo_urls" text[] not null default '{}',
  "category_id" uuid null,
  "question_pack_id" uuid null,
  "classification_scores" jsonb null,
  "is_paused" boolean not null default false,
  "pause_reason" text null,
  "assigned_by_user_id" uuid null,
  "optimal_card_id" uuid null,
  "closed_at" timestamptz null,
  constraint "inquiry_pkey" primary key ("id")
);`);
        this.addSql(`create index "inquiry_client_user_id_created_at_index" on "inquiry" ("client_user_id", "created_at");`);
        this.addSql(`create index "inquiry_status_created_at_index" on "inquiry" ("status", "created_at");`);
        this.addSql(`create index "inquiry_category_id_index" on "inquiry" ("category_id");`);
        this.addSql(
            `alter table "inquiry" add constraint "inquiry_client_user_id_foreign" foreign key ("client_user_id") references "app_user" ("id") on update cascade on delete restrict;`,
        );
        this.addSql(
            `alter table "inquiry" add constraint "inquiry_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "inquiry" add constraint "inquiry_question_pack_id_foreign" foreign key ("question_pack_id") references "question_pack" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "inquiry" add constraint "inquiry_assigned_by_user_id_foreign" foreign key ("assigned_by_user_id") references "app_user" ("id") on update cascade on delete set null;`,
        );

        this.addSql(`
create table "inquiry_answer" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "inquiry_id" uuid not null,
  "category_question_id" uuid not null,
  "value_text" text null,
  "value_json" jsonb null,
  "answered_at" timestamptz not null default now(),
  constraint "inquiry_answer_pkey" primary key ("id")
);`);
        this.addSql(
            `alter table "inquiry_answer" add constraint "inquiry_answer_inquiry_id_category_question_id_unique" unique ("inquiry_id", "category_question_id");`,
        );
        this.addSql(
            `alter table "inquiry_answer" add constraint "inquiry_answer_inquiry_id_foreign" foreign key ("inquiry_id") references "inquiry" ("id") on update cascade on delete cascade;`,
        );
        this.addSql(
            `alter table "inquiry_answer" add constraint "inquiry_answer_category_question_id_foreign" foreign key ("category_question_id") references "category_question" ("id") on update cascade on delete restrict;`,
        );

        this.addSql(`
create table "research_run" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "inquiry_id" uuid not null,
  "source" varchar(128) not null,
  "status" "research_run_status" not null default 'PENDING',
  "external_run_url" varchar(2048) null,
  "failure_reason" text null,
  "started_at" timestamptz null,
  "finished_at" timestamptz null,
  constraint "research_run_pkey" primary key ("id")
);`);
        this.addSql(
            `create index "research_run_inquiry_id_created_at_index" on "research_run" ("inquiry_id", "created_at");`,
        );
        this.addSql(`create index "research_run_status_index" on "research_run" ("status");`);
        this.addSql(
            `alter table "research_run" add constraint "research_run_inquiry_id_foreign" foreign key ("inquiry_id") references "inquiry" ("id") on update cascade on delete cascade;`,
        );

        this.addSql(`
create table "offer" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "research_run_id" uuid null,
  "canonical_product_id" uuid null,
  "company_id" uuid null,
  "storefront_id" uuid null,
  "category_site_id" uuid null,
  "source_url" varchar(2048) not null,
  "price" numeric null,
  "currency" varchar(3) null,
  "volume_tier" text null,
  "moq" numeric null,
  "quote_text" text null,
  "supplier_role" "supplier_role" not null default 'UNVERIFIED',
  "captured_at" timestamptz not null,
  "expires_at" timestamptz null,
  constraint "offer_pkey" primary key ("id")
);`);
        this.addSql(`create index "offer_source_url_index" on "offer" ("source_url");`);
        this.addSql(
            `create index "offer_canonical_product_id_captured_at_index" on "offer" ("canonical_product_id", "captured_at");`,
        );
        this.addSql(`create index "offer_research_run_id_index" on "offer" ("research_run_id");`);
        this.addSql(
            `alter table "offer" add constraint "offer_research_run_id_foreign" foreign key ("research_run_id") references "research_run" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "offer" add constraint "offer_canonical_product_id_foreign" foreign key ("canonical_product_id") references "canonical_product" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "offer" add constraint "offer_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "offer" add constraint "offer_storefront_id_foreign" foreign key ("storefront_id") references "storefront" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "offer" add constraint "offer_category_site_id_foreign" foreign key ("category_site_id") references "category_site" ("id") on update cascade on delete set null;`,
        );

        this.addSql(`
create table "market_snapshot" (
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
            `create index "market_snapshot_canonical_product_id_layer_captured_at_index" on "market_snapshot" ("canonical_product_id", "layer", "captured_at");`,
        );
        this.addSql(`create index "market_snapshot_research_run_id_index" on "market_snapshot" ("research_run_id");`);
        this.addSql(
            `alter table "market_snapshot" add constraint "market_snapshot_research_run_id_foreign" foreign key ("research_run_id") references "research_run" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "market_snapshot" add constraint "market_snapshot_inquiry_id_foreign" foreign key ("inquiry_id") references "inquiry" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "market_snapshot" add constraint "market_snapshot_canonical_product_id_foreign" foreign key ("canonical_product_id") references "canonical_product" ("id") on update cascade on delete set null;`,
        );

        this.addSql(`
create table "optimal_card" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "category_id" uuid not null,
  "canonical_product_id" uuid not null,
  "qty_min" numeric not null,
  "qty_max" numeric not null,
  "is_live" boolean not null default false,
  "offer_id" uuid null,
  "company_id" uuid null,
  "storefront_id" uuid null,
  "price" numeric null,
  "currency" varchar(3) null,
  "contact_value" varchar(512) null,
  "contact_channel" "contact_channel" null,
  "contact_url" varchar(2048) null,
  "contact_admin_entered" boolean not null default false,
  "contact_entered_at" timestamptz null,
  "product_attributes" jsonb null,
  "reason_note" text null,
  "marked_live_by_user_id" uuid null,
  "marked_live_at" timestamptz null,
  "expires_at" timestamptz null,
  constraint "optimal_card_pkey" primary key ("id")
);`);
        this.addSql(
            `create index "optimal_card_canonical_product_id_qty_min_qty_max_is_live_index" on "optimal_card" ("canonical_product_id", "qty_min", "qty_max", "is_live");`,
        );
        this.addSql(
            `create unique index "optimal_card_one_live_per_product_qty" on "optimal_card" ("canonical_product_id", "qty_min", "qty_max") where "is_live" = true;`,
        );
        this.addSql(
            `alter table "optimal_card" add constraint "optimal_card_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete restrict;`,
        );
        this.addSql(
            `alter table "optimal_card" add constraint "optimal_card_canonical_product_id_foreign" foreign key ("canonical_product_id") references "canonical_product" ("id") on update cascade on delete restrict;`,
        );
        this.addSql(
            `alter table "optimal_card" add constraint "optimal_card_offer_id_foreign" foreign key ("offer_id") references "offer" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "optimal_card" add constraint "optimal_card_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "optimal_card" add constraint "optimal_card_storefront_id_foreign" foreign key ("storefront_id") references "storefront" ("id") on update cascade on delete set null;`,
        );
        this.addSql(
            `alter table "optimal_card" add constraint "optimal_card_marked_live_by_user_id_foreign" foreign key ("marked_live_by_user_id") references "app_user" ("id") on update cascade on delete set null;`,
        );

        this.addSql(
            `alter table "inquiry" add constraint "inquiry_optimal_card_id_foreign" foreign key ("optimal_card_id") references "optimal_card" ("id") on update cascade on delete set null;`,
        );

        this.addSql(`
create table "manual_economics" (
  "id" uuid not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz null default now(),
  "inquiry_id" uuid not null,
  "optimal_card_id" uuid null,
  "fx_rate" numeric null,
  "logistics_cost" numeric null,
  "duty_cost" numeric null,
  "markup_amount" numeric null,
  "client_price" numeric null,
  "currency" varchar(3) null,
  "note" text null,
  constraint "manual_economics_pkey" primary key ("id")
);`);
        this.addSql(
            `alter table "manual_economics" add constraint "manual_economics_inquiry_id_unique" unique ("inquiry_id");`,
        );
        this.addSql(
            `alter table "manual_economics" add constraint "manual_economics_inquiry_id_foreign" foreign key ("inquiry_id") references "inquiry" ("id") on update cascade on delete cascade;`,
        );
        this.addSql(
            `alter table "manual_economics" add constraint "manual_economics_optimal_card_id_foreign" foreign key ("optimal_card_id") references "optimal_card" ("id") on update cascade on delete set null;`,
        );
    }

    override async down(): Promise<void> {
        this.addSql(`drop table if exists "manual_economics" cascade;`);
        this.addSql(`alter table "inquiry" drop constraint if exists "inquiry_optimal_card_id_foreign";`);
        this.addSql(`drop table if exists "optimal_card" cascade;`);
        this.addSql(`drop table if exists "market_snapshot" cascade;`);
        this.addSql(`drop table if exists "offer" cascade;`);
        this.addSql(`drop table if exists "research_run" cascade;`);
        this.addSql(`drop table if exists "inquiry_answer" cascade;`);
        this.addSql(`drop table if exists "inquiry" cascade;`);
        this.addSql(`drop table if exists "storefront" cascade;`);
        this.addSql(`drop table if exists "company" cascade;`);
        this.addSql(`drop table if exists "canonical_product" cascade;`);
        this.addSql(`drop table if exists "category_site" cascade;`);
        this.addSql(`drop table if exists "category_question" cascade;`);
        this.addSql(`drop table if exists "question_pack" cascade;`);
        this.addSql(`drop table if exists "category_phrase" cascade;`);
        this.addSql(`drop table if exists "category" cascade;`);
        this.addSql(`drop table if exists "app_user" cascade;`);

        this.addSql(`drop type if exists "contact_channel";`);
        this.addSql(`drop type if exists "research_run_status";`);
        this.addSql(`drop type if exists "company_registry_status";`);
        this.addSql(`drop type if exists "market_price_layer";`);
        this.addSql(`drop type if exists "supplier_role";`);
        this.addSql(`drop type if exists "inquiry_status";`);
        this.addSql(`drop type if exists "site_role";`);
        this.addSql(`drop type if exists "question_answer_type";`);
        this.addSql(`drop type if exists "category_status";`);
        this.addSql(`drop type if exists "user_role";`);
    }
}
