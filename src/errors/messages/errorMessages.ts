export const ERROR_MESSAGES = {
  TARGET_NETWORK_NOT_FOUND: 'Target network not found in config. Please run `select-target-chain`.',
  AMOUNT_EXCEEDS_BALANCE: 'Entered amount exceeds wallet balance.',
  SIGNATURE_VERIFICATION_FAILED: 'Signature verification failed.',
  APPROVAL_NOT_CONFIRMED_ON_CHAIN: 'Approval not confirmed on-chain!',
  AMOUNT_MUST_BE_GREATER_THAN_ZERO: 'Amount must be > 0',
  INVALID_CONFIG: 'Invalid config: currentNetwork missing or malformed.',
  MISSING_EVENT_ARGUMENT: 'Missing event argument in event',
  INVALID_ADDRESS: 'Invalid Ethereum address provided.',
  CONTRACT_NOT_FOUND: 'No contract found at the specified address.',
  ORIGINAL_TOKEN_NOT_FOUND: 'Original token address not found in config. Please run `select-token`.',
  CURRENT_NETWORK_CONFIG_INVALID: 'Current network configuration is invalid or missing.',
  TARGET_CHAIN_NOT_SELECTED: 'No target chain selected. Please run `select-target-chain` first.',
  DOMAIN_SEPARATOR_MISMATCH: 'Domain separator mismatch!',
  INVALID_CLAIM_TYPE: 'Invalid claim type.',
  UNKNOWN_CHAIN_ID: (chainId: number | string) =>
    `Unknown network chainId ${chainId} in config file.`,
  UNSUPPORTED_EVENT_TYPE_FOR_LOCK_CLAIM: (eventName: string) =>
    `Unsupported event type for lock claim: ${eventName}`,
  UNSUPPORTED_EVENT_TYPE_FOR_BURN_CLAIM: (eventName: string) =>
    `Unsupported event type for burn claim: ${eventName}`,
};