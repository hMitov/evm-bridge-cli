import { Command } from 'commander';
import { ethers } from 'ethers';
import { BridgeConfig } from '../types';
import { getNetworkByChainId } from '../config/networks';

export abstract class BaseCommand {
  protected config!: BridgeConfig; // Using definite assignment assertion

  constructor() {
    this.initializeConfig();
  }

  protected initializeConfig(): void {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('Private key not found in environment variables');
    }

    const currentChainId = parseInt(process.env.CURRENT_CHAIN_ID || '11155111'); // Default to Sepolia
    const network = getNetworkByChainId(currentChainId);
    
    if (!network) {
      throw new Error(`Network with chain ID ${currentChainId} not found`);
    }

    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    this.config = {
      networks: {},
      currentNetwork: network,
      wallet,
      provider
    };
  }

  public async execute(): Promise<void> {
    try {
      await this.action();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error occurred');
      process.exit(1);
    }
  }

  protected abstract action(): Promise<void>;
} 