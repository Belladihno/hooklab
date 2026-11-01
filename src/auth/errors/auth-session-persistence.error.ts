export class AuthSessionPersistenceError extends Error {
  constructor(readonly dbCode?: string) {
    super('Auth session could not be saved');
    this.name = 'AuthSessionPersistenceError';
  }
}
