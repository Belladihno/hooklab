import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ListProjectsQueryDto } from './dto/list-projects.query.dto.js';
import {
  ProjectCreatedResponseDto,
  ProjectKeyResponseDto,
  ProjectResponseDto,
} from './dto/response/project.response.dto.js';
import { generateEndpointKey } from './endpoint-key.js';
import { ProjectNameAlreadyExistsError } from './errors/project-name-already-exists.error.js';
import {
  toCreatedProjectResponse,
  toProjectResponse,
} from './mappers/project.mapper.js';
import { ProjectRepository } from './repositories/project.repository.js';

const PROJECT_NOT_FOUND = 'Project not found';

@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectRepository) {}

  async list(
    userId: string,
    query: ListProjectsQueryDto,
  ): Promise<ProjectResponseDto[]> {
    const projects = await this.projects.findByUser(
      userId,
      query.limit,
      query.offset,
    );

    return projects.map(toProjectResponse);
  }

  async create(
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectCreatedResponseDto> {
    const endpointKey = generateEndpointKey();

    try {
      const project = await this.projects.create({
        userId,
        name: dto.name,
        endpointKeyHash: endpointKey.hash,
      });

      return toCreatedProjectResponse(project, endpointKey.raw);
    } catch (error) {
      if (error instanceof ProjectNameAlreadyExistsError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  async get(userId: string, id: string): Promise<ProjectResponseDto> {
    const project = await this.projects.findByIdForUser(id, userId);

    if (!project) {
      throw new NotFoundException(PROJECT_NOT_FOUND);
    }

    return toProjectResponse(project);
  }

  async remove(userId: string, id: string): Promise<void> {
    const project = await this.projects.findByIdForUser(id, userId);

    if (!project) {
      throw new NotFoundException(PROJECT_NOT_FOUND);
    }

    await this.projects.removePermanently(project.id);
  }

  async rotateEndpointKey(
    userId: string,
    id: string,
  ): Promise<ProjectKeyResponseDto> {
    const endpointKey = generateEndpointKey();
    const rotated = await this.projects.rotateEndpointKey(
      id,
      userId,
      endpointKey.hash,
    );

    if (!rotated) {
      throw new NotFoundException(PROJECT_NOT_FOUND);
    }

    return new ProjectKeyResponseDto(endpointKey.raw);
  }
}
