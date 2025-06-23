export class SelectTokenError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`Select token command failed | Reason: ${message}`);
    this.name = 'SelectTokenError';
  }
}
