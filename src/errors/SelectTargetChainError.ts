export class SelectTargetChainError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`Select target chain command failed | Reason: ${message}`);
    this.name = 'SelectTargetChainError';
  }
}
