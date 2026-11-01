import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';

@Entity({ name: 'auth_attempts' })
@Index('IDX_auth_attempts_email_hash_created_at', ['emailHash', 'createdAt'])
@Index('IDX_auth_attempts_ip_created_at', ['ip', 'createdAt'])
export class AuthAttempt extends BaseEntity {
  @Column({ name: 'email_hash', type: 'varchar', length: 64 })
  declare emailHash: string;

  @Column({ type: 'varchar', length: 45 })
  declare ip: string;

  @Column({ type: 'varchar', length: 32 })
  declare action: string;

  @Column({ type: 'varchar', length: 16 })
  declare outcome: string;
}
