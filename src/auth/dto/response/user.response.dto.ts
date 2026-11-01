export class UserResponseDto {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly createdAt: string,
  ) {}
}
