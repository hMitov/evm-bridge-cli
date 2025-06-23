export class LockTokenError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`Lock token command failed | Reason: ${message}`);
    this.name = 'LockTokenError';
  }
}
