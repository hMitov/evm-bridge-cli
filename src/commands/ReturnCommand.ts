import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { returnToken } from '../utils/blockchain';

export class ReturnCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const { targetChainId, nonce, signature } = await inquirer.prompt([
      {
        type: 'input',
        name: 'targetChainId',
        message: 'Enter target chain ID:',
      },
      {
        type: 'input',
        name: 'nonce',
        message: 'Enter nonce:',
      },
      {
        type: 'input',
        name: 'signature',
        message: 'Enter signature:',
      },
    ]);
    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to return:',
        validate: (input: string) => {
          if (isNaN(Number(input)) || Number(input) <= 0) {
            return 'Please enter a valid positive number';
          }
          return true;
        }
      }
    ]);

    try {
      const amountWei = ethers.parseUnits(amount, 18); // Assuming 18 decimals for simplicity
      console.log('\nReturning tokens...');
      
      const tx = await returnToken("", "", amountWei, Number(targetChainId), Number(nonce));
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
    } catch (error) {
      console.error('Error returning tokens:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
} 