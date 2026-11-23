import { Migration } from '@mikro-orm/migrations';

/**
 * Книга ставок владельца. По умолчанию пустая.
 * Калькулятор без строк отвечает rates_not_configured.
 */
export class Migration20261123190000_LogisticsRates extends Migration {
    override async up(): Promise<void> {
        this.addSql(`
            create table "logistics_rate" (
                "id" uuid not null,
                "mode" varchar(64) not null,
                "label" varchar(256) not null,
                "origin_place" varchar(128) not null,
                "destination" varchar(128) not null,
                "currency" varchar(3) not null,
                "price_per_kg" numeric not null,
                "fx_to_rub" numeric not null,
                "min_charge" numeric not null default 0,
                "transit_days_min" int not null default 0,
                "transit_days_max" int not null default 0,
                "included" jsonb not null default '[]',
                "is_active" boolean not null default true,
                "created_at" timestamptz not null default now(),
                "updated_at" timestamptz null default now(),
                constraint "logistics_rate_pkey" primary key ("id")
            );
        `);
        this.addSql(`create index "logistics_rate_destination_idx" on "logistics_rate" ("destination");`);
        this.addSql(`create index "logistics_rate_is_active_idx" on "logistics_rate" ("is_active");`);
    }

    override async down(): Promise<void> {
        this.addSql(`drop table if exists "logistics_rate";`);
    }
}
