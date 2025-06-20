import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { getTokenInfo } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { TokenInfo } from '../types';

export class SelectTokenCommand extends BaseCommand {
  private validateAddress(input: string): boolean | string {
    return ethers.isAddress(input) ? true : 'Please enter a valid Ethereum address';
  }

  protected async action(): Promise<void> {
    const cliConfig = cliConfigManager.getCliConfig();
    const provider = new ethers.WebSocketProvider(cliConfig.currentNetwork.wsUrl);

    try {
      const { tokenAddress } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tokenAddress',
          message: 'Enter token contract address:',
          validate: this.validateAddress,
        },
      ]);

      let contractCode: string;
      try {
        contractCode = await provider.getCode(tokenAddress);
      } catch (error) {
        console.error('Failed to fetch contract code:', error instanceof Error ? error.message : error);
        throw new Error('Unable to verify contract at the specified address.');
      }

      if (contractCode === '0x') {
        throw new Error('No contract found at the specified address.');
      }

      let tokenInfo: TokenInfo;
      try {
        tokenInfo = await getTokenInfo(tokenAddress);
      } catch (error) {
        console.error('Error fetching token information:', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
      
      console.log('\nToken Information:');
      console.log('-----------------');
      console.log(`Symbol: ${tokenInfo.symbol}`);
      console.log(`Decimals: ${tokenInfo.decimals}`);
      console.log(`Your Balance: ${tokenInfo.balance}`);
      console.log(`Address: ${tokenInfo.address}`);
      
      const updatedConfig = {
        ...cliConfig,
        originalToken: tokenAddress,
      };
      cliConfigManager.saveCliConfig(updatedConfig);
    } catch (error) {
      console.error('Error selecting token:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
