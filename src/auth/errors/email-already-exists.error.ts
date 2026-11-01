export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email is already registered');
    this.name = 'EmailAlreadyExistsError';
  }
}
