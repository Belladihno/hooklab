import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1792859960445 implements MigrationInterface {
  name = 'Baseline1792859960445';

  async up(_queryRunner: QueryRunner): Promise<void> {}

  async down(_queryRunner: QueryRunner): Promise<void> {}
}
