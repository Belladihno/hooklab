import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../database/base.repository.js';
import { User } from '../entities/user.entity.js';
import { EmailAlreadyExistsError } from '../errors/email-already-exists.error.js';
import { UserPersistenceError } from '../errors/user-persistence.error.js';

export interface NewUser {
  email: string;
  passwordHash: string;
}

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

function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === '23505';
}

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>,
  ) {
    super(repository);
  }

  async create(data: NewUser): Promise<User> {
    try {
      const user = this.repository.create(data);
      user.createdBy = user.id;
      user.updatedBy = user.id;

      return await this.persist(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new EmailAlreadyExistsError();
      }

      throw new UserPersistenceError(errorCode(error));
    }
  }

  findByEmailForAuth(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }
}
