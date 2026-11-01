import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';
import { User } from './user.entity.js';

@Entity({ name: 'cli_tokens' })
@Index('IDX_cli_tokens_user_id', ['userId'])
export class CliToken extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  declare userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_cli_tokens_user_id',
  })
  declare user: User;

  @Column({ type: 'varchar', length: 255 })
  declare name: string;

  @Column({
    name: 'token_hash',
    type: 'varchar',
    length: 64,
    unique: true,
    select: false,
  })
  declare tokenHash: string;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null = null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null = null;
}
