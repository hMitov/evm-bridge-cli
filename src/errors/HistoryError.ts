export class HistoryError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'Unknown error';

    super(`History command failed | Reason: ${message}`);
    this.name = 'HistoryError';
  }
} 