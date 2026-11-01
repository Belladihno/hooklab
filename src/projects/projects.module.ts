import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module.js';
import { Project } from './entities/project.entity.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { ProjectRepository } from './repositories/project.repository.js';

@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Project])],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectRepository],
})
export class ProjectsModule {}
