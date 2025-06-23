export class BridgeClientError extends Error {
    constructor(cause: unknown) {
        const message =
            cause instanceof Error
                ? cause.message
                : typeof cause === 'string'
                    ? cause
                    : 'Unknown error';

        super(`Bridge client error | Reason: ${message}`);
        this.name = 'BridgeClientError';
    }
}
