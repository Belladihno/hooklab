import { UserResponseDto } from '../dto/response/user.response.dto.js';

export function toUserResponse(user: {
  id: string;
  email: string;
  createdAt: Date;
}): UserResponseDto {
  return new UserResponseDto(user.id, user.email, user.createdAt.toISOString());
}
