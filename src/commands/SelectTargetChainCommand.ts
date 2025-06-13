import inquirer from 'inquirer';
import { BaseCommand } from './BaseCommand';
import { getNetworkList } from '../config/networks';

export class SelectTargetChainCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const availableNetworks = getNetworkList().filter(
      network => network.chainId !== this.config.currentNetwork.chainId
    );

    if (availableNetworks.length === 0) {
      console.log('No other networks available for bridging.');
      return;
    }

    const { targetChainId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'targetChainId',
        message: 'Select target chain:',
        choices: availableNetworks.map(network => ({
          name: network.name,
          value: network.chainId
        }))
      }
    ]);

    // Store selected target chain in environment or config for other commands
    process.env.TARGET_CHAIN_ID = targetChainId.toString();
    
    console.log(`\nSelected target chain: ${availableNetworks.find(n => n.chainId === targetChainId)?.name}`);
  }
} 