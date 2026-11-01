export class ProjectResponseDto {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly createdAt: string,
    readonly updatedAt: string,
  ) {}
}

export class ProjectCreatedResponseDto extends ProjectResponseDto {
  constructor(
    id: string,
    name: string,
    createdAt: string,
    updatedAt: string,
    readonly endpointKey: string,
  ) {
    super(id, name, createdAt, updatedAt);
  }
}

export class ProjectKeyResponseDto {
  constructor(readonly endpointKey: string) {}
}
