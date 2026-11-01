import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCliTokens1792925000000 implements MigrationInterface {
  name = 'CreateCliTokens1792925000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cli_tokens" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "last_used_at" timestamptz,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_cli_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cli_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_cli_tokens_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_cli_tokens_user_id" ON "cli_tokens" ("user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "cli_tokens"');
  }
}
