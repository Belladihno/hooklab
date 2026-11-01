export class CliTokenCreatedResponseDto {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly createdAt: string,
    readonly token: string,
  ) {}
}
