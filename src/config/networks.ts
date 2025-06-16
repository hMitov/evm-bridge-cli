import { NetworkConfig } from '../types';

export const networks: Record<number, NetworkConfig> = {
  11155111: {
    name: 'Sepolia',
    chainId: 11155111,
    wsUrl: process.env.ETHEREUM_SEPOLIA_WS_URL || '',
    bridgeFactoryAddress: process.env.ETHEREUM_SEPOLIA_BRIDGE_FACTORY || '',
    explorerUrl: 'https://sepolia.etherscan.io'
  },
  84532: {
    name: 'Base',
    chainId: 84532,
    wsUrl: process.env.BASE_SEPOLIA_WS_URL || '',
    bridgeFactoryAddress: process.env.BASE_SEPOLIA_BRIDGE_FACTORY || '',
    explorerUrl: 'https://basescan.org'
  }
};

export const getNetworkByChainId = (chainId: number): NetworkConfig => {
  const network = networks[chainId];
  if (!network) {
    throw new Error(`Network with chain ID ${chainId} not found`);
  }
  return network;
};

export const getNetworkList = (): NetworkConfig[] => {
  return Object.values(networks);
}; 