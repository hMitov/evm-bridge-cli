import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { claimToken } from '../utils/blockchain';

export class ClaimCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const { amount, nonce, sourceChainId, signature, isWrapped } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to claim:',
        validate: (input: string) => {
          if (isNaN(Number(input)) || Number(input) <= 0) {
            return 'Please enter a valid positive number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'nonce',
        message: 'Enter nonce:',
        validate: (input: string) => {
          if (isNaN(Number(input)) || Number(input) < 0) {
            return 'Please enter a valid non-negative number';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'sourceChainId',
        message: 'Enter source chain ID:',
        validate: (input: string) => {
          if (isNaN(Number(input)) || Number(input) <= 0) {
            return 'Please enter a valid chain ID';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'signature',
        message: 'Enter signature:',
        validate: (input: string) => {
          if (!input.startsWith('0x') || input.length !== 132) {
            return 'Please enter a valid signature (0x-prefixed, 66 bytes)';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'isWrapped',
        message: 'Is this a wrapped token claim?',
        default: true
      }
    ]);

    try {
      const amountWei = ethers.parseUnits(amount, 18); // Assuming 18 decimals for simplicity
      console.log('\nClaiming tokens...');
      
      const tx = await claimToken(
        this.config,
        amountWei,
        BigInt(nonce),
        Number(sourceChainId),
        signature,
        isWrapped
      );
      
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
    } catch (error) {
      console.error('Error claiming tokens:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
} 