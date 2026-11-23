import { Migration } from '@mikro-orm/migrations';

/**
 * Дерево Wikkeo и ссылка заявки на узел.
 * Старый плоский category не трогаем.
 */
export class Migration20261123140000_TaxonomyNodes extends Migration {
    override async up(): Promise<void> {
        this.addSql(`
            create table "taxonomy_node" (
                "id" int not null,
                "parent_id" int null,
                "slug" varchar(255) not null,
                "name" varchar(255) not null,
                "path_label" text not null,
                "level" int not null,
                "child_count" int not null default 0,
                "is_private" boolean not null default false,
                "url" varchar(2048) null,
                "created_at" timestamptz not null default now(),
                "updated_at" timestamptz null default now(),
                constraint "taxonomy_node_pkey" primary key ("id")
            );
        `);
        this.addSql(`create index "taxonomy_node_parent_id_idx" on "taxonomy_node" ("parent_id");`);
        this.addSql(`create index "taxonomy_node_slug_idx" on "taxonomy_node" ("slug");`);
        this.addSql(`create index "taxonomy_node_path_label_idx" on "taxonomy_node" ("path_label");`);
        this.addSql(`create index "taxonomy_node_name_idx" on "taxonomy_node" ("name");`);
        this.addSql(`
            alter table "taxonomy_node"
            add constraint "taxonomy_node_parent_id_foreign"
            foreign key ("parent_id") references "taxonomy_node" ("id")
            on update cascade on delete set null;
        `);

        this.addSql(`alter table "inquiry" add column "taxonomy_node_id" int null;`);
        this.addSql(`
            alter table "inquiry"
            add constraint "inquiry_taxonomy_node_id_foreign"
            foreign key ("taxonomy_node_id") references "taxonomy_node" ("id")
            on update cascade on delete set null;
        `);
        this.addSql(`create index "inquiry_taxonomy_node_id_idx" on "inquiry" ("taxonomy_node_id");`);
    }

    override async down(): Promise<void> {
        this.addSql(`alter table "inquiry" drop constraint if exists "inquiry_taxonomy_node_id_foreign";`);
        this.addSql(`drop index if exists "inquiry_taxonomy_node_id_idx";`);
        this.addSql(`alter table "inquiry" drop column "taxonomy_node_id";`);

        this.addSql(`alter table "taxonomy_node" drop constraint if exists "taxonomy_node_parent_id_foreign";`);
        this.addSql(`drop table if exists "taxonomy_node";`);
    }
}
