import { cliConfigManager } from '../config/cliConfig';
import inquirer from 'inquirer';
import { getNetworkConfigByChainId, getNetworkConfigList } from '../config/networks';
import { BaseCommand } from './BaseCommand';
import { CLIConfig, NetworkConfig } from '../types';
import { SwitchNetworkError } from '../errors/SwitchNetworkError';
import { BridgeUtils } from '../utils/BridgeUtils';
import { ERROR_MESSAGES } from '../errors/messages/errorMessages';

export class SwitchNetworkCommand extends BaseCommand {

  protected async action(): Promise<void> {
    const currentConfig = cliConfigManager.getCliConfig();
    
    try {
      BridgeUtils.validateSwitchNetworkConfig(currentConfig);

      const availableNetworks: NetworkConfig[] = getNetworkConfigList();

      if (availableNetworks.length === 0) {
        console.log('No available networks configured.');
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
        throw new SwitchNetworkError(ERROR_MESSAGES.UNKNOWN_CHAIN_ID(chainId));
      }
      
      if (chainId === currentConfig.currentNetwork.chainId) {
        console.log(`Already connected to ${currentConfig.currentNetwork.name}`);
        return;
      }

      const updatedConfig: CLIConfig = {
        ...currentConfig,
        currentNetwork: selectedNetwork,
      };

      cliConfigManager.saveCliConfig(updatedConfig);
      console.log(`\nSuccessfully switched to ${selectedNetwork.name}`);
      console.log(`WS URL: ${selectedNetwork.wsUrl}`);
      console.log(`Chain ID: ${selectedNetwork.chainId}`);
    } catch (error) {
      if (error instanceof SwitchNetworkError) {
        console.error('Switch network error:', error.message);
        throw error;
      }
      console.error('Unexpected error switching network:', error instanceof Error ? error.message : error);
      throw new SwitchNetworkError(error);
    }
  }
}
