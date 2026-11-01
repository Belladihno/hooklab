export class ProjectPersistenceError extends Error {
  constructor(readonly dbCode?: string) {
    super('Project could not be saved');
    this.name = 'ProjectPersistenceError';
  }
}
