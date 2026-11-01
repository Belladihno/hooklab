import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersBaseEntityColumns1792900000000 implements MigrationInterface {
  name = 'AddUsersBaseEntityColumns1792900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "id" DROP DEFAULT,
        ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN "created_by" uuid,
        ADD COLUMN "updated_by" uuid,
        ADD COLUMN "version" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "created_by" = "id", "updated_by" = "id"
      WHERE "created_by" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
        DROP COLUMN "version",
        DROP COLUMN "updated_by",
        DROP COLUMN "created_by",
        DROP COLUMN "updated_at"
    `);
  }
}
