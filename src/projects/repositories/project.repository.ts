import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../database/base.repository.js';
import { Project } from '../entities/project.entity.js';
import { ProjectNameAlreadyExistsError } from '../errors/project-name-already-exists.error.js';
import { ProjectPersistenceError } from '../errors/project-persistence.error.js';

export interface NewProject {
  userId: string;
  name: string;
  endpointKeyHash: string;
}

function driverError(error: unknown): {
  code?: unknown;
  constraint?: unknown;
} | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const failed = error as {
    code?: unknown;
    constraint?: unknown;
    driverError?: { code?: unknown; constraint?: unknown };
  };

  return failed.driverError ?? failed;
}

function errorCode(error: unknown): string | undefined {
  const code = driverError(error)?.code;

  return typeof code === 'string' ? code : undefined;
}

function uniqueConstraint(error: unknown): string | undefined {
  if (errorCode(error) !== '23505') {
    return undefined;
  }

  const constraint = driverError(error)?.constraint;

  return typeof constraint === 'string' ? constraint : undefined;
}

@Injectable()
export class ProjectRepository extends BaseRepository<Project> {
  constructor(
    @InjectRepository(Project)
    repository: Repository<Project>,
  ) {
    super(repository);
  }

  async create(data: NewProject): Promise<Project> {
    try {
      const project = this.repository.create({
        userId: data.userId,
        name: data.name,
        endpointKeyHash: data.endpointKeyHash,
        createdBy: data.userId,
        updatedBy: data.userId,
      });

      return await this.persist(project);
    } catch (error) {
      if (uniqueConstraint(error) === 'UQ_projects_user_id_name') {
        throw new ProjectNameAlreadyExistsError();
      }

      throw new ProjectPersistenceError(errorCode(error));
    }
  }

  findByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<Project[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  findByIdForUser(id: string, userId: string): Promise<Project | null> {
    return this.repository.findOne({ where: { id, userId } });
  }

  async rotateEndpointKey(
    id: string,
    userId: string,
    endpointKeyHash: string,
  ): Promise<boolean> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(Project)
        .set({
          endpointKeyHash,
          updatedAt: new Date(),
          updatedBy: userId,
          version: () => '"version" + 1',
        })
        .where('"id" = :id', { id })
        .andWhere('"user_id" = :userId', { userId })
        .execute();

      return (result.affected ?? 0) > 0;
    } catch (error) {
      throw new ProjectPersistenceError(errorCode(error));
    }
  }
}
