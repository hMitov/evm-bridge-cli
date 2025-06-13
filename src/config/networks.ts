import { NetworkConfig } from '../types';

export const networks: Record<number, NetworkConfig> = {
  11155111: { // Sepolia
    name: 'Sepolia',
    chainId: 11155111,
    rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL || '',
    bridgeFactoryAddress: process.env.SEPOLIA_BRIDGE_FACTORY || '',
    explorerUrl: 'https://sepolia.etherscan.io'
  },
  8453: { // Base
    name: 'Base',
    chainId: 8453,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || '',
    bridgeFactoryAddress: process.env.BASE_BRIDGE_FACTORY || '',
    explorerUrl: 'https://basescan.org'
  }
};

export const getNetworkByChainId = (chainId: number): NetworkConfig | undefined => {
  return networks[chainId];
};

export const getNetworkList = (): NetworkConfig[] => {
  return Object.values(networks);
}; 