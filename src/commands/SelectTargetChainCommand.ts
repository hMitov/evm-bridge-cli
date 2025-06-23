import inquirer from 'inquirer';
import { BaseCommand } from './BaseCommand';
import { getNetworkConfigList } from '../config/networks';
import { cliConfigManager } from '../config/cliConfig';
import { NetworkConfig } from '../types';
import { SelectTargetChainError } from '../errors/SelectTargetChainError';
import { BridgeUtils } from '../utils/BridgeUtils';

export class SelectTargetChainCommand extends BaseCommand {

  protected async action(): Promise<void> {
    const cliConfig = cliConfigManager.getCliConfig();

    try {
      BridgeUtils.validateSelectTargetChainConfig(cliConfig);

      const currentChainId: number = cliConfig.currentNetwork.chainId;

      const availableNetworks: NetworkConfig[] = getNetworkConfigList().filter(
        net => net.chainId !== currentChainId
      );

      if (availableNetworks.length === 0) {
        console.log('No other networks available for bridging.');
        return;
      }

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
      if (error instanceof SelectTargetChainError) {
        console.error('Select target chain error:', error.message);
        throw error;
      }
      console.error('Unexpected error selecting target chain:', error instanceof Error ? error.message : error);
      throw new SelectTargetChainError(error);
    }
  }
}
