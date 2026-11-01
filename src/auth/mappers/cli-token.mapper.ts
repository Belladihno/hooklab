import type { CliToken } from '../entities/cli-token.entity.js';
import { CliTokenCreatedResponseDto } from '../dto/response/cli-token.response.dto.js';

export function toCreatedCliTokenResponse(
  token: CliToken,
  rawToken: string,
): CliTokenCreatedResponseDto {
  return new CliTokenCreatedResponseDto(
    token.id,
    token.name,
    token.createdAt.toISOString(),
    rawToken,
  );
}
