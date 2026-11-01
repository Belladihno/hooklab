import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity.js';
import { User } from './user.entity.js';

@Entity({ name: 'auth_sessions' })
@Index('IDX_auth_sessions_user_id', ['userId'])
export class AuthSession extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  declare userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_auth_sessions_user_id',
  })
  declare user: User;

  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 64,
    unique: true,
    select: false,
  })
  declare refreshTokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  declare expiresAt: Date;

  @Column({ name: 'idle_expires_at', type: 'timestamptz' })
  declare idleExpiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null = null;

  @Column({
    name: 'last_used_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastUsedAt: Date = new Date();
}
