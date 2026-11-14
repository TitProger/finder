import { Migration } from '@mikro-orm/migrations';

/**
 * Add `code` column to category and category_question for YAML seed support.
 * Stable codes allow idempotent upserts and webhook-friendly identifiers.
 */
export class Migration20261114130000_AddCodeToCategories extends Migration {
    override async up(): Promise<void> {
        // Add code to category (unique, nullable for admin-created categories)
        this.addSql(`alter table "category" add column "code" varchar(64) null;`);
        this.addSql(`alter table "category" add constraint "category_code_unique" unique ("code");`);
        this.addSql(`create index "category_code_index" on "category" ("code");`);

        // Add code to category_question (unique within category, nullable for admin-created questions)
        this.addSql(`alter table "category_question" add column "code" varchar(64) null;`);
        this.addSql(
            `alter table "category_question" add constraint "category_question_category_id_code_unique" unique ("category_id", "code");`,
        );
        this.addSql(`create index "category_question_code_index" on "category_question" ("code");`);
    }

    override async down(): Promise<void> {
        this.addSql(`alter table "category" drop constraint "category_code_unique";`);
        this.addSql(`drop index "category_code_index";`);
        this.addSql(`alter table "category" drop column "code";`);

        this.addSql(`alter table "category_question" drop constraint "category_question_category_id_code_unique";`);
        this.addSql(`drop index "category_question_code_index";`);
        this.addSql(`alter table "category_question" drop column "code";`);
    }
}
