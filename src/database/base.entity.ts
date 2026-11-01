import {
  Column,
  CreateDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { uuidV7 } from './uuid-v7.js';

export abstract class BaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string = uuidV7();

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date = new Date();

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date = new Date();

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null = null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null = null;

  @VersionColumn({ type: 'int', default: 1 })
  version: number = 1;
}
