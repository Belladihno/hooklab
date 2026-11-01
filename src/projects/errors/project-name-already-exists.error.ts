export class ProjectNameAlreadyExistsError extends Error {
  constructor() {
    super('A project with this name already exists');
    this.name = 'ProjectNameAlreadyExistsError';
  }
}
