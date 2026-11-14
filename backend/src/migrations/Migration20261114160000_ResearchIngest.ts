import { Migration } from '@mikro-orm/migrations';

/**
 * Колонки досье на research_run и offer, роль компании и таблица контактов.
 */
export class Migration20261114160000_ResearchIngest extends Migration {
    override async up(): Promise<void> {
        this.addSql(`ALTER TYPE "market_price_layer" ADD VALUE IF NOT EXISTS 'FACTORY';`);

        this.addSql(`alter table "research_run" add column "run_id" uuid null;`);
        this.addSql(`alter table "research_run" add column "dossier_status" varchar(16) null;`);
        this.addSql(`alter table "research_run" add column "sites" jsonb null;`);
        this.addSql(`alter table "research_run" add column "fx" jsonb null;`);
        this.addSql(`alter table "research_run" add column "summary_ru" text null;`);
        this.addSql(`alter table "research_run" add column "raw_payload" jsonb null;`);
        this.addSql(`alter table "research_run" add column "payload_sha256" varchar(64) null;`);
        this.addSql(`alter table "research_run" add column "discarded" jsonb null;`);
        this.addSql(`alter table "research_run" add column "ingest_result" jsonb null;`);
        this.addSql(
            `alter table "research_run" add constraint "research_run_run_id_unique" unique ("run_id");`,
        );

        this.addSql(`alter table "offer" add column "layer" "market_price_layer" null;`);
        this.addSql(`alter table "offer" add column "site" varchar(128) null;`);
        this.addSql(`alter table "offer" add column "unit" varchar(32) null;`);
        this.addSql(`alter table "offer" add column "qty_from" numeric(12,2) null;`);
        this.addSql(`alter table "offer" add column "title" text null;`);

        this.addSql(`alter table "company" add column "name" varchar(512) null;`);
        this.addSql(`alter table "company" add column "role" "supplier_role" null;`);
        this.addSql(`alter table "company" add column "role_evidence" jsonb null;`);

        this.addSql(`
            create table "company_contact" (
                "id" uuid not null,
                "created_at" timestamptz not null default now(),
                "updated_at" timestamptz null,
                "company_id" uuid not null,
                "channel" varchar(16) not null,
                "value" text not null,
                "source_url" varchar(2048) not null,
                "captured_at" timestamptz not null,
                constraint "company_contact_pkey" primary key ("id")
            );
        `);
        this.addSql(
            `alter table "company_contact" add constraint "company_contact_company_id_foreign" foreign key ("company_id") references "company" ("id") on update cascade on delete cascade;`,
        );
        this.addSql(`create index "company_contact_company_id_index" on "company_contact" ("company_id");`);
    }

    override async down(): Promise<void> {
        this.addSql(`drop table if exists "company_contact";`);
        this.addSql(`alter table "company" drop column if exists "role_evidence";`);
        this.addSql(`alter table "company" drop column if exists "role";`);
        this.addSql(`alter table "company" drop column if exists "name";`);
        this.addSql(`alter table "offer" drop column if exists "title";`);
        this.addSql(`alter table "offer" drop column if exists "qty_from";`);
        this.addSql(`alter table "offer" drop column if exists "unit";`);
        this.addSql(`alter table "offer" drop column if exists "site";`);
        this.addSql(`alter table "offer" drop column if exists "layer";`);
        this.addSql(
            `alter table "research_run" drop constraint if exists "research_run_run_id_unique";`,
        );
        this.addSql(`alter table "research_run" drop column if exists "ingest_result";`);
        this.addSql(`alter table "research_run" drop column if exists "discarded";`);
        this.addSql(`alter table "research_run" drop column if exists "payload_sha256";`);
        this.addSql(`alter table "research_run" drop column if exists "raw_payload";`);
        this.addSql(`alter table "research_run" drop column if exists "summary_ru";`);
        this.addSql(`alter table "research_run" drop column if exists "fx";`);
        this.addSql(`alter table "research_run" drop column if exists "sites";`);
        this.addSql(`alter table "research_run" drop column if exists "dossier_status";`);
        this.addSql(`alter table "research_run" drop column if exists "run_id";`);
    }
}
