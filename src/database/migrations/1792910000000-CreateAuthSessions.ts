import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSessions1792910000000 implements MigrationInterface {
  name = 'CreateAuthSessions1792910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "refresh_token_hash" character varying(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "idle_expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "last_used_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_auth_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_sessions_refresh_token_hash" UNIQUE ("refresh_token_hash"),
        CONSTRAINT "FK_auth_sessions_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_sessions"');
  }
}
