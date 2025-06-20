import { cliConfigManager } from '../config/cliConfig';
import inquirer from 'inquirer';
import { getNetworkConfigByChainId, getNetworkConfigList } from '../config/networks';
import { BaseCommand } from './BaseCommand';
import { CLIConfig, NetworkConfig } from '../types';

export class SwitchNetworkCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const availableNetworks: NetworkConfig[] = getNetworkConfigList();

    if (availableNetworks.length === 0) {
      console.error('No available networks configured.');
      return;
    }

    const { chainId } = await inquirer.prompt<{ chainId: number }>([
      {
        type: 'list',
        name: 'chainId',
        message: 'Select network to switch to:',
        choices: availableNetworks.map((net) => ({
          name: `${net.name} (chainId: ${net.chainId})`,
          value: net.chainId,
        })),
      },
    ]);

    const selectedNetwork: NetworkConfig = getNetworkConfigByChainId(chainId);
    if (!selectedNetwork) {
      console.error(`Network with chainId ${chainId} not found.`);
      return;
    }

    const currentConfig: CLIConfig = cliConfigManager.getCliConfig();

    if (chainId === currentConfig.currentNetwork.chainId) {
      console.log(`Already connected to ${currentConfig.currentNetwork.name}`);
      return;
    }

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
