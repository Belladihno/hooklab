export class UserPersistenceError extends Error {
  constructor(readonly dbCode?: string) {
    super('Failed to persist user');
    this.name = 'UserPersistenceError';
  }
}
