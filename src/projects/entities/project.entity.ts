import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { BaseEntity } from '../../database/base.entity.js';

@Entity({ name: 'projects' })
@Unique('UQ_projects_user_id_name', ['userId', 'name'])
export class Project extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  declare userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_projects_user_id',
  })
  declare user: User;

  @Column({ type: 'varchar', length: 255 })
  declare name: string;

  @Column({
    name: 'endpoint_key_hash',
    type: 'varchar',
    length: 64,
    unique: true,
    select: false,
  })
  declare endpointKeyHash: string;
}
