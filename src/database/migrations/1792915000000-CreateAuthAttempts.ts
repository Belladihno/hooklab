import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthAttempts1792915000000 implements MigrationInterface {
  name = 'CreateAuthAttempts1792915000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_attempts" (
        "id" uuid NOT NULL,
        "email_hash" character varying(64) NOT NULL,
        "ip" character varying(45) NOT NULL,
        "action" character varying(32) NOT NULL,
        "outcome" character varying(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_auth_attempts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_attempts_email_hash_created_at"
        ON "auth_attempts" ("email_hash", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_attempts_ip_created_at"
        ON "auth_attempts" ("ip", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_attempts"');
  }
}
