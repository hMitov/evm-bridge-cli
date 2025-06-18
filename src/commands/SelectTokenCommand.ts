import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { getTokenInfo } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';

export class SelectTokenCommand extends BaseCommand {
  private validateAddress(input: string): boolean | string {
    return ethers.isAddress(input) ? true : 'Please enter a valid Ethereum address';
  }

  protected async action(): Promise<void> {
    const cliConfig = cliConfigManager.getCliConfig();
    const provider = new ethers.WebSocketProvider(cliConfig.currentNetwork.wsUrl);

    const { tokenAddress } = await inquirer.prompt([
      {
        type: 'input',
        name: 'tokenAddress',
        message: 'Enter token contract address:',
        validate: this.validateAddress,
      },
    ]);

    let code: string;
    try {
      code = await provider.getCode(tokenAddress);
    } catch (e) {
      console.error('Failed to fetch contract code:', e);
      throw new Error('Unable to verify contract at the specified address.');
    }

    if (code === '0x') {
      throw new Error('No contract found at the specified address.');
    }

    try {
      const tokenInfo = await getTokenInfo(tokenAddress);
      console.log('\nToken Information:');
      console.log('-----------------');
      console.log(`Symbol: ${tokenInfo.symbol}`);
      console.log(`Decimals: ${tokenInfo.decimals}`);
      console.log(`Your Balance: ${tokenInfo.balance}`);
      console.log(`Address: ${tokenInfo.address}`);

      cliConfig.selectedToken = tokenAddress;
      cliConfigManager.saveCliConfig(cliConfig);
    } catch (error) {
      console.error('Error fetching token information:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
