export class ConfigError extends Error {
    constructor(cause: unknown) {
        const message =
            cause instanceof Error
                ? cause.message
                : typeof cause === 'string'
                    ? cause
                    : 'Unknown error';

        super(`Config error | Reason: ${message}`);
        this.name = 'ConfigError';
    }
}
