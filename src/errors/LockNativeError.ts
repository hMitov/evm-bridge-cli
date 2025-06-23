export class LockNativeError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`Lock native command failed | Reason: ${message}`);
    this.name = 'LockNativeError';
  }
}
