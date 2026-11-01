import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 320, unique: true })
  declare email: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  declare passwordHash: string;
}
