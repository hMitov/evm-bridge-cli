import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { lockToken } from '../utils/blockchain';

export class LockCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const tokenAddress = process.env.SELECTED_TOKEN;
    if (!tokenAddress) {
      throw new Error('No token selected. Please run select-token first.');
    }

    const targetChainId = process.env.TARGET_CHAIN_ID;
    if (!targetChainId) {
      throw new Error('No target chain selected. Please run select-target-chain first.');
    }

    const { amount, usePermit } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to lock:',
        validate: (input: string) => {
          if (isNaN(Number(input)) || Number(input) <= 0) {
            return 'Please enter a valid positive number';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'usePermit',
        message: 'Use permit for gas-efficient approval?',
        default: true
      }
    ]);

    try {
      const amountWei = ethers.parseUnits(amount, 18); // Assuming 18 decimals for simplicity
      console.log('\nLocking tokens...');
      
      const tx = await lockToken(this.config, tokenAddress, amountWei, usePermit);
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
    } catch (error) {
      console.error('Error locking tokens:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
} 