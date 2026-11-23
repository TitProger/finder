import { Migration } from '@mikro-orm/migrations';

/**
 * Optimal card → утверждённое досье / live-кэш.
 * Review категории/оффера/поставщика, безопасный отчёт, текст похожего совпадения.
 */
export class Migration20261123180000_ApprovedDossierCache extends Migration {
    override async up(): Promise<void> {
        this.addSql(`create type "dossier_review_decision" as enum ('pending', 'approved', 'rejected');`);

        this.addSql(`alter table "optimal_card" add column "category_review" "dossier_review_decision" not null default 'pending';`);
        this.addSql(`alter table "optimal_card" add column "offer_review" "dossier_review_decision" not null default 'pending';`);
        this.addSql(`alter table "optimal_card" add column "supplier_review" "dossier_review_decision" not null default 'pending';`);
        this.addSql(`alter table "optimal_card" add column "review_note" text null;`);
        this.addSql(`alter table "optimal_card" add column "match_text" varchar(1024) null;`);
        this.addSql(`alter table "optimal_card" add column "public_report" jsonb null;`);
        this.addSql(`alter table "optimal_card" add column "revalidate_at" timestamptz null;`);

        this.addSql(`update "optimal_card" set "revalidate_at" = "expires_at" where "expires_at" is not null;`);
        this.addSql(`
            update "optimal_card" as card
            set "match_text" = lower(coalesce(product."name_ru", ''))
            from "canonical_product" as product
            where product."id" = card."canonical_product_id"
              and (card."match_text" is null or card."match_text" = '');
        `);

        this.addSql(`create index "optimal_card_live_match_text_index" on "optimal_card" ("category_id", "is_live", "match_text");`);
    }

    override async down(): Promise<void> {
        this.addSql(`drop index if exists "optimal_card_live_match_text_index";`);
        this.addSql(`alter table "optimal_card" drop column "revalidate_at";`);
        this.addSql(`alter table "optimal_card" drop column "public_report";`);
        this.addSql(`alter table "optimal_card" drop column "match_text";`);
        this.addSql(`alter table "optimal_card" drop column "review_note";`);
        this.addSql(`alter table "optimal_card" drop column "supplier_review";`);
        this.addSql(`alter table "optimal_card" drop column "offer_review";`);
        this.addSql(`alter table "optimal_card" drop column "category_review";`);
        this.addSql(`drop type if exists "dossier_review_decision";`);
    }
}
