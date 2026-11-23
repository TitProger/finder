import { Migration } from '@mikro-orm/migrations';

/**
 * profile_json клиентской заявки. Недостающее поле — null, не выдумка.
 */
export class Migration20261123120000_InquiryProfileJson extends Migration {
    override async up(): Promise<void> {
        this.addSql(`alter table "inquiry" add column "profile_json" jsonb null;`);
    }

    override async down(): Promise<void> {
        this.addSql(`alter table "inquiry" drop column "profile_json";`);
    }
}
