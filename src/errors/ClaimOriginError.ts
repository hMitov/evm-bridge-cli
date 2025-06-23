export class ClaimOriginError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`Claim origin command failed | Reason: ${message}`);
    this.name = 'ClaimOriginError';
  }
} 