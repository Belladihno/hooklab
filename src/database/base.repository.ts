import {
  EntityManager,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { isHardDeleteAllowed } from './hard-delete-tables.js';

export abstract class BaseRepository<T extends BaseEntity & ObjectLiteral> {
  constructor(protected readonly repository: Repository<T>) {}

  protected scoped(manager?: EntityManager): Repository<T> {
    return manager
      ? manager.getRepository(this.repository.target)
      : this.repository;
  }

  async findById(id: string, manager?: EntityManager): Promise<T | null> {
    return this.scoped(manager).findOne({
      where: { id } as FindOptionsWhere<T>,
    });
  }

  async persist(entity: T, manager?: EntityManager): Promise<T> {
    return this.scoped(manager).save(entity);
  }

  async removePermanently(
    id: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const tableName = this.repository.metadata.tableName;

    if (!isHardDeleteAllowed(tableName)) {
      throw new Error(
        `Hard delete on ${tableName}, which is not on HARD_DELETE_TABLES. Soft delete it, or add it there and grant DELETE in its migration.`,
      );
    }

    const result = await this.scoped(manager).delete(id);

    return (result.affected ?? 0) > 0;
  }
}
