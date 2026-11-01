import type { Project } from '../entities/project.entity.js';
import {
  ProjectCreatedResponseDto,
  ProjectResponseDto,
} from '../dto/response/project.response.dto.js';

export function toProjectResponse(project: Project): ProjectResponseDto {
  return new ProjectResponseDto(
    project.id,
    project.name,
    project.createdAt.toISOString(),
    project.updatedAt.toISOString(),
  );
}

export function toCreatedProjectResponse(
  project: Project,
  endpointKey: string,
): ProjectCreatedResponseDto {
  return new ProjectCreatedResponseDto(
    project.id,
    project.name,
    project.createdAt.toISOString(),
    project.updatedAt.toISOString(),
    endpointKey,
  );
}
