import { Migration } from '@mikro-orm/migrations';

/**
 * Файлы сида и витрина истории поиска. Старые таблицы не меняются.
 */
export class Migration20261122120000_SearchedProducts extends Migration {
    override async up(): Promise<void> {
        this.addSql(
            `create table "stored_file" ("id" uuid not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz null, "deleted_at" timestamptz null, "storage_key" varchar(512) not null, "mime" varchar(128) not null, "size_bytes" int not null, constraint "stored_file_pkey" primary key ("id"));`,
        );
        this.addSql(`alter table "stored_file" add constraint "stored_file_storage_key_unique" unique ("storage_key");`);

        this.addSql(
            `create table "searched_product" ("id" uuid not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz null, "deleted_at" timestamptz null, "slug" varchar(128) not null, "name" varchar(512) not null, "category_label" varchar(255) not null, "chip_label" varchar(64) null, "material_count" int not null, "searched_at" timestamptz not null, "article" varchar(64) null, "cover_file_id" uuid null, "dossier" jsonb null, constraint "searched_product_pkey" primary key ("id"));`,
        );
        this.addSql(`alter table "searched_product" add constraint "searched_product_slug_unique" unique ("slug");`);
        this.addSql(
            `alter table "searched_product" add constraint "searched_product_cover_file_id_foreign" foreign key ("cover_file_id") references "stored_file" ("id") on update cascade on delete set null;`,
        );
        this.addSql(`create index "searched_product_category_label_index" on "searched_product" ("category_label");`);
        this.addSql(`create index "searched_product_searched_at_index" on "searched_product" ("searched_at");`);
    }

    override async down(): Promise<void> {
        this.addSql(`drop table if exists "searched_product";`);
        this.addSql(`drop table if exists "stored_file";`);
    }
}
