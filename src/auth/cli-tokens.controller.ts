import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { SignedIn } from '../common/access/access.decorators.js';
import { CliTokensService } from './cli-tokens.service.js';
import { CreateCliTokenDto } from './dto/create-cli-token.dto.js';
import { CliTokenCreatedResponseDto } from './dto/response/cli-token.response.dto.js';
import type { AuthenticatedRequest } from './types/authenticated-request.js';

@Controller('api/v1/auth/cli-tokens')
@SignedIn()
export class CliTokensController {
  constructor(private readonly tokens: CliTokensService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCliTokenDto,
  ): Promise<CliTokenCreatedResponseDto> {
    return this.tokens.create(request.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.tokens.revoke(request.user.id, id);
  }
}
