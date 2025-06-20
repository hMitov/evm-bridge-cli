import inquirer from 'inquirer';
import { BaseCommand } from './BaseCommand';
import { getNetworkConfigList } from '../config/networks';
import { cliConfigManager } from '../config/cliConfig';
import { NetworkConfig } from '../types';

export class SelectTargetChainCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const cliConfig = cliConfigManager.getCliConfig();
    const currentChainId: number = cliConfig.currentNetwork.chainId;

    const availableNetworks: NetworkConfig[] = getNetworkConfigList().filter(
      net => net.chainId !== currentChainId
    );

    if (availableNetworks.length === 0) {
      console.log('No other networks available for bridging.');
      return;
    }

    try {
      const { targetChainId }: { targetChainId: number } = await inquirer.prompt([
        {
          type: 'list',
          name: 'targetChainId',
          message: 'Select target chain:',
          choices: availableNetworks.map(net => ({ 
            name: net.name,
            value: net.chainId 
          })),
        },
      ]);

      const updatedConfig = {
        ...cliConfig,
        targetChainId,
      };
      cliConfigManager.saveCliConfig(updatedConfig);

      const selectedNetwork = availableNetworks.find((n) => n.chainId === targetChainId);
      console.log(`\nSelected target chain: ${selectedNetwork?.name ?? 'Unknown'}`);
    } catch (error) {
      console.error('Error selecting target chain:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
