import { cliConfigManager } from '../config/cliConfig';
import inquirer from 'inquirer';
import { getNetworkByChainId, getNetworkList } from '../config/networks';
import { BaseCommand } from './BaseCommand';
import { CLIConfig } from '../types';

export class SwitchNetworkCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const availableNetworks = getNetworkList();

    const { chainId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'chainId',
        message: 'Select network to switch to:',
        choices: availableNetworks.map(net => ({
          name: `${net.name} (chainId: ${net.chainId})`,
          value: net.chainId,
        })),
      },
    ]);

    const selectedNetwork = getNetworkByChainId(chainId);
    if (!selectedNetwork) {
      console.error(`Network with chainId ${chainId} not found.`);
      return;
    }

    const currentConfig = cliConfigManager.getCliConfig();
    if (chainId === currentConfig.currentNetwork.chainId) {
      console.log(`Already connected to ${currentConfig.currentNetwork.name}`);
      return;
    }

    // Update and save config
    const updatedConfig: CLIConfig = {
      ...currentConfig,
      currentNetwork: selectedNetwork,
    };

    try {
      cliConfigManager.saveCliConfig(updatedConfig);
      console.log(`\nSuccessfully switched to ${selectedNetwork.name}`);
      console.log(`WS URL: ${selectedNetwork.wsUrl}`);
      console.log(`Chain ID: ${selectedNetwork.chainId}`);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }
}
