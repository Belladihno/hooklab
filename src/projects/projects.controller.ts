import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { SignedIn } from '../common/access/access.decorators.js';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ListProjectsQueryDto } from './dto/list-projects.query.dto.js';
import {
  ProjectCreatedResponseDto,
  ProjectKeyResponseDto,
  ProjectResponseDto,
} from './dto/response/project.response.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('api/v1/projects')
@SignedIn()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListProjectsQueryDto,
  ): Promise<ProjectResponseDto[]> {
    return this.projects.list(request.user.id, query);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectCreatedResponseDto> {
    return this.projects.create(request.user.id, dto);
  }

  @Get(':id')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectResponseDto> {
    return this.projects.get(request.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.projects.remove(request.user.id, id);
  }

  @Post(':id/rotate-key')
  @HttpCode(HttpStatus.OK)
  rotateEndpointKey(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectKeyResponseDto> {
    return this.projects.rotateEndpointKey(request.user.id, id);
  }
}
