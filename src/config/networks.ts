import { ConfigError } from '../errors/ConfigError';
import { ERROR_MESSAGES } from '../errors/messages/errorMessages';
import { NetworkConfig } from '../types';
import {
  ETHEREUM_SEPOLIA_WS_URL,
  BASE_SEPOLIA_WS_URL,
  ETHEREUM_SEPOLIA_BRIDGE_FACTORY,
  BASE_SEPOLIA_BRIDGE_FACTORY,
  ETHEREUM_SEPOLIA_NAME,
  ETHEREUM_SEPOLIA_EXPLORER_URL,
  BASE_SEPOLIA_NAME,
  BASE_SEPOLIA_EXPLORER_URL,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
} from './configLoader';

export const networks: Record<number, NetworkConfig> = {
  [ETHEREUM_SEPOLIA_CHAIN_ID]: {
    name: ETHEREUM_SEPOLIA_NAME,
    chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
    wsUrl: ETHEREUM_SEPOLIA_WS_URL,
    bridgeFactoryAddress: ETHEREUM_SEPOLIA_BRIDGE_FACTORY,
    explorerUrl: ETHEREUM_SEPOLIA_EXPLORER_URL
  },
  [BASE_SEPOLIA_CHAIN_ID]: {
    name: BASE_SEPOLIA_NAME,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    wsUrl: BASE_SEPOLIA_WS_URL,
    bridgeFactoryAddress: BASE_SEPOLIA_BRIDGE_FACTORY,
    explorerUrl: BASE_SEPOLIA_EXPLORER_URL
  }
};

export const getNetworkConfigByChainId = (chainId: number): NetworkConfig => {
  const network = networks[chainId];
  if (!network) {
    throw new ConfigError(ERROR_MESSAGES.UNKNOWN_CHAIN_ID(chainId));
  }
  return network;
};

export const getNetworkConfigList = (): NetworkConfig[] => {
  return Object.values(networks);
}; 