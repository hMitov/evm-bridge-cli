import inquirer from 'inquirer';
import { BaseCommand } from './BaseCommand';
import { getNetworkList } from '../config/networks';
import { cliConfigManager } from '../config/cliConfig';

export class SelectTargetChainCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const cliConfig = cliConfigManager.getCliConfig();
    const currentChainId = cliConfig.currentNetwork.chainId;

    const availableNetworks = getNetworkList().filter(net => net.chainId !== currentChainId);

    if (availableNetworks.length === 0) {
      console.log('No other networks available for bridging.');
      return;
    }

    try {
      const { targetChainId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'targetChainId',
          message: 'Select target chain:',
          choices: availableNetworks.map(net => ({ name: net.name, value: net.chainId }))
        }
      ]);

      cliConfig.targetChainId = targetChainId;
      cliConfigManager.saveCliConfig(cliConfig);

      const selectedNetwork = availableNetworks.find(n => n.chainId === targetChainId);
      console.log(`\nSelected target chain: ${selectedNetwork ? selectedNetwork.name : 'Unknown'}`);
    } catch (error) {
      console.error('Error selecting target chain:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
