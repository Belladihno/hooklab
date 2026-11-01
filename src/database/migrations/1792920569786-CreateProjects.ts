import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjects1792920569786 implements MigrationInterface {
  name = 'CreateProjects1792920569786';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "endpoint_key_hash" character varying(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_projects" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_projects_user_id_name" UNIQUE ("user_id", "name"),
        CONSTRAINT "UQ_projects_endpoint_key_hash" UNIQUE ("endpoint_key_hash"),
        CONSTRAINT "FK_projects_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "projects"');
  }
}
