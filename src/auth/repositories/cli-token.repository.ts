import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../database/base.repository.js';
import { CliToken } from '../entities/cli-token.entity.js';
import { CliTokenPersistenceError } from '../errors/cli-token-persistence.error.js';

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

export interface NewCliToken {
  userId: string;
  name: string;
  tokenHash: string;
}

@Injectable()
export class CliTokenRepository extends BaseRepository<CliToken> {
  constructor(
    @InjectRepository(CliToken)
    repository: Repository<CliToken>,
  ) {
    super(repository);
  }

  async create(data: NewCliToken): Promise<CliToken> {
    try {
      const token = this.repository.create({
        ...data,
        createdBy: data.userId,
        updatedBy: data.userId,
      });

      return await this.persist(token);
    } catch (error) {
      throw new CliTokenPersistenceError(errorCode(error));
    }
  }

  findByIdForUser(id: string, userId: string): Promise<CliToken | null> {
    return this.repository.findOne({ where: { id, userId } });
  }

  async revoke(id: string, userId: string, now: Date): Promise<void> {
    try {
      await this.repository
        .createQueryBuilder()
        .update(CliToken)
        .set({
          revokedAt: now,
          updatedAt: now,
          updatedBy: userId,
          version: () => '"version" + 1',
        })
        .where('"id" = :id', { id })
        .andWhere('"user_id" = :userId', { userId })
        .andWhere('revoked_at IS NULL')
        .execute();
    } catch (error) {
      throw new CliTokenPersistenceError(errorCode(error));
    }
  }
}
