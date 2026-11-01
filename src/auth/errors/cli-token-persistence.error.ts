export class CliTokenPersistenceError extends Error {
  constructor(readonly dbCode?: string) {
    super('CLI token could not be saved');
    this.name = 'CliTokenPersistenceError';
  }
}
