import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../database/base.repository.js';
import { AuthSession } from '../entities/auth-session.entity.js';
import { AuthSessionPersistenceError } from '../errors/auth-session-persistence.error.js';

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const failed = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  const code = failed.code ?? failed.driverError?.code;

  return typeof code === 'string' ? code : undefined;
}

export interface NewAuthSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  idleExpiresAt: Date;
  lastUsedAt: Date;
}

@Injectable()
export class AuthSessionRepository extends BaseRepository<AuthSession> {
  constructor(
    @InjectRepository(AuthSession)
    repository: Repository<AuthSession>,
  ) {
    super(repository);
  }

  async create(data: NewAuthSession): Promise<AuthSession> {
    try {
      const session = this.repository.create({
        ...data,
        createdBy: data.userId,
        updatedBy: data.userId,
      });

      return await this.persist(session);
    } catch (error) {
      throw new AuthSessionPersistenceError(errorCode(error));
    }
  }

  override findById(id: string): Promise<AuthSession | null> {
    return this.repository
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .where('session.id = :id', { id })
      .getOne();
  }

  async rotate(
    id: string,
    currentHash: string,
    nextHash: string,
    idleExpiresAt: Date,
    userId: string,
    now: Date,
  ): Promise<boolean> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(AuthSession)
        .set({
          refreshTokenHash: nextHash,
          idleExpiresAt,
          lastUsedAt: now,
          updatedAt: now,
          updatedBy: userId,
          version: () => 'version + 1',
        })
        .where('id = :id', { id })
        .andWhere('refresh_token_hash = :currentHash', { currentHash })
        .andWhere('revoked_at IS NULL')
        .andWhere('expires_at > :now', { now })
        .andWhere('idle_expires_at > :now', { now })
        .execute();

      return (result.affected ?? 0) === 1;
    } catch (error) {
      throw new AuthSessionPersistenceError(errorCode(error));
    }
  }

  async revoke(id: string, now: Date): Promise<void> {
    try {
      await this.repository
        .createQueryBuilder()
        .update(AuthSession)
        .set({ revokedAt: now, updatedAt: now })
        .where('id = :id', { id })
        .andWhere('revoked_at IS NULL')
        .execute();
    } catch (error) {
      throw new AuthSessionPersistenceError(errorCode(error));
    }
  }
}
