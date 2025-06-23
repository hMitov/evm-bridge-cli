export class RelayerError extends Error {
    constructor(cause: unknown) {
        const message =
            cause instanceof Error
                ? cause.message
                : typeof cause === 'string'
                    ? cause
                    : 'Unknown error';

        super(`Relayer error | Reason: ${message}`);
        this.name = 'RelayerError';
    }
}
