import inquirer from 'inquirer';
import { BaseCommand } from './BaseCommand';
import { getNetworkList } from '../config/networks';

export class SwitchNetworkCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const availableNetworks = getNetworkList();

    const { chainId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'chainId',
        message: 'Select network to switch to:',
        choices: availableNetworks.map(network => ({
          name: network.name,
          value: network.chainId
        }))
      }
    ]);

    if (chainId === this.config.currentNetwork.chainId) {
      console.log(`Already connected to ${this.config.currentNetwork.name}`);
      return;
    }

    try {
      // Update environment variable
      process.env.CURRENT_CHAIN_ID = chainId.toString();
      
      // Reinitialize config with new network
      this.initializeConfig();
      
      console.log(`\nSuccessfully switched to ${this.config.currentNetwork.name}`);
      console.log(`RPC URL: ${this.config.currentNetwork.rpcUrl}`);
      console.log(`Chain ID: ${this.config.currentNetwork.chainId}`);
    } catch (error) {
      console.error('Error switching network:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
} 