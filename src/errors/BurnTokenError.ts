export class BurnTokenError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`Burn token command failed | Reason: ${message}`);
    this.name = 'BurnTokenError';
  }
}
