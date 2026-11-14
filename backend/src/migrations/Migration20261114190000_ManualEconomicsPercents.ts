import { Migration } from '@mikro-orm/migrations';

export class Migration20261114190000_ManualEconomicsPercents extends Migration {
    override async up(): Promise<void> {
        this.addSql(
            'alter table "manual_economics" add column "duty_percent" numeric(8,4) null, add column "other_cost" numeric(14,4) null, add column "markup_percent" numeric(8,4) null;',
        );
    }

    override async down(): Promise<void> {
        this.addSql(
            'alter table "manual_economics" drop column if exists "duty_percent", drop column if exists "other_cost", drop column if exists "markup_percent";',
        );
    }
}
