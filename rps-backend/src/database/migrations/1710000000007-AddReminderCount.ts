import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReminderCount1710000000007 implements MigrationInterface {
  name = 'AddReminderCount1710000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaign_participants"
      ADD COLUMN IF NOT EXISTS "reminder_count" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaign_participants"
      DROP COLUMN IF EXISTS "reminder_count"
    `);
  }
}
