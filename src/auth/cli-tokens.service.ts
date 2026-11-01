import { Injectable, NotFoundException } from '@nestjs/common';
import { generateCliToken } from './cli-token.js';
import { CreateCliTokenDto } from './dto/create-cli-token.dto.js';
import { CliTokenCreatedResponseDto } from './dto/response/cli-token.response.dto.js';
import { toCreatedCliTokenResponse } from './mappers/cli-token.mapper.js';
import { CliTokenRepository } from './repositories/cli-token.repository.js';

@Injectable()
export class CliTokensService {
  constructor(private readonly tokens: CliTokenRepository) {}

  async create(
    userId: string,
    dto: CreateCliTokenDto,
  ): Promise<CliTokenCreatedResponseDto> {
    const token = generateCliToken();
    const created = await this.tokens.create({
      userId,
      name: dto.name,
      tokenHash: token.hash,
    });

    return toCreatedCliTokenResponse(created, token.raw);
  }

  async revoke(userId: string, id: string): Promise<void> {
    const token = await this.tokens.findByIdForUser(id, userId);

    if (!token) {
      throw new NotFoundException('CLI token not found');
    }

    if (token.revokedAt !== null) {
      return;
    }

    await this.tokens.revoke(id, userId, new Date());
  }
}
