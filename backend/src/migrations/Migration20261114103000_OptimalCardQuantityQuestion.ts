import { Migration } from '@mikro-orm/migrations';

/**
 * Вопрос объёма на оптимальной карточке.
 * Число этого обязательного NUMBER-вопроса ищется внутри qty_min…qty_max.
 */
export class Migration20261114103000_OptimalCardQuantityQuestion extends Migration {
    override async up(): Promise<void> {
        this.addSql(`alter table "optimal_card" add column "quantity_question_id" uuid not null;`);
        this.addSql(
            `alter table "optimal_card" add constraint "optimal_card_quantity_question_id_foreign" foreign key ("quantity_question_id") references "category_question" ("id") on update cascade on delete restrict;`,
        );
        this.addSql(
            `create index "optimal_card_quantity_question_id_index" on "optimal_card" ("quantity_question_id");`,
        );
    }

    override async down(): Promise<void> {
        this.addSql(`drop index if exists "optimal_card_quantity_question_id_index";`);
        this.addSql(
            `alter table "optimal_card" drop constraint if exists "optimal_card_quantity_question_id_foreign";`,
        );
        this.addSql(`alter table "optimal_card" drop column if exists "quantity_question_id";`);
    }
}
