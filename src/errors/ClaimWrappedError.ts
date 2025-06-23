export class ClaimWrappedError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`Claim wrapped command failed | Reason: ${message}`);
    this.name = 'ClaimWrappedError';
  }
}
