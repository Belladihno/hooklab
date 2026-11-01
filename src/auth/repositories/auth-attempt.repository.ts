import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { BaseRepository } from '../../database/base.repository.js';
import { AuthAttempt } from '../entities/auth-attempt.entity.js';

export interface NewAuthAttempt {
  emailHash: string;
  ip: string;
  action: string;
  outcome: 'failure' | 'success';
  createdAt: Date;
}

@Injectable()
export class AuthAttemptRepository extends BaseRepository<AuthAttempt> {
  constructor(
    @InjectRepository(AuthAttempt)
    repository: Repository<AuthAttempt>,
  ) {
    super(repository);
  }

  async record(data: NewAuthAttempt): Promise<void> {
    const attempt = this.repository.create(data);

    await this.persist(attempt);
  }

  countEmailFailures(
    emailHash: string,
    action: string,
    since: Date,
  ): Promise<number> {
    return this.repository.count({
      where: {
        emailHash,
        action,
        outcome: 'failure',
        createdAt: MoreThanOrEqual(since),
      },
    });
  }

  countIpAttempts(ip: string, since: Date): Promise<number> {
    return this.repository.count({
      where: {
        ip,
        createdAt: MoreThanOrEqual(since),
      },
    });
  }
}
