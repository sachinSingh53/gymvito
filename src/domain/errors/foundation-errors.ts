export class MissingDatabaseKeyError extends Error {
  constructor() {
    super('An encrypted database exists but its device key is unavailable. Restore is required.');
    this.name = 'MissingDatabaseKeyError';
  }
}

export class UnsupportedDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedDatabaseError';
  }
}

export class BackupValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BackupValidationError';
  }
}
