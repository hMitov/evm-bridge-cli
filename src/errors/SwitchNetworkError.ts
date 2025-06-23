export class SwitchNetworkError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`Switch network command failed | Reason: ${message}`);
    this.name = 'SwitchNetworkError';
  }
}
