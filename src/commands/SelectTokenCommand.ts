import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { getTokenInfo } from '../utils/BridgeClient';
import { cliConfigManager } from '../config/cliConfig';
import { TokenInfo } from '../types';
import { SelectTokenError } from '../errors/SelectTokenError';
import { BridgeUtils } from '../utils/BridgeUtils';

export class SelectTokenCommand extends BaseCommand {

  protected async action(): Promise<void> {
    const cliConfig = cliConfigManager.getCliConfig();
    const provider = new ethers.WebSocketProvider(cliConfig.currentNetwork.wsUrl);

    try {
      const { tokenAddress } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tokenAddress',
          message: 'Enter token contract address:',
          validate: BridgeUtils.validateAddress,
        },
      ]);

      await BridgeUtils.verifyContractExists(provider, tokenAddress);

      const tokenInfo: TokenInfo = await getTokenInfo(tokenAddress);

      console.log(`\nToken Info: Symbol=${tokenInfo.symbol}, Decimals=${tokenInfo.decimals}, Balance=${tokenInfo.balance}, Address=${tokenInfo.address}`);

      const updatedConfig = {
        ...cliConfig,
        originalToken: tokenAddress,
      };
      cliConfigManager.saveCliConfig(updatedConfig);

    } catch (error) {
      if (error instanceof SelectTokenError) {
        console.error('Select token error:', error.message);
        throw error;
      }
      console.error('Unexpected error selecting token:', error instanceof Error ? error.message : error);
      throw new SelectTokenError(error);
    } finally {
      provider.destroy();
    }
  }
}
