import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { getTokenInfo } from '../utils/blockchain';

export class SelectTokenCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const { tokenAddress } = await inquirer.prompt([
      {
        type: 'input',
        name: 'tokenAddress',
        message: 'Enter token contract address:',
        validate: (input: string) => {
          if (!ethers.isAddress(input)) {
            return 'Please enter a valid Ethereum address';
          }
          return true;
        }
      }
    ]);

    try {
      const tokenInfo = await getTokenInfo(this.config, tokenAddress);
      console.log('\nToken Information:');
      console.log('-----------------');
      console.log(`Symbol: ${tokenInfo.symbol}`);
      console.log(`Decimals: ${tokenInfo.decimals}`);
      console.log(`Your Balance: ${tokenInfo.balance}`);
      console.log(`Address: ${tokenInfo.address}`);

      // Store selected token in environment or config for other commands
      process.env.SELECTED_TOKEN = tokenAddress;
    } catch (error) {
      console.error('Error fetching token information:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
} 