import inquirer from 'inquirer';
import { ethers, Contract } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { lockToken } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/config';

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function nonces(address) view returns (uint256)",
  "function name() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

function getProviderAndWallet() {
  const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
  const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
  const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
  return { provider, wallet, currentNetwork };
}

export class LockCommand extends BaseCommand {
  
  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();
    console.log('DEBUG: Current CLI config:', config);

    const tokenAddress = config.selectedToken;
    if (!tokenAddress) {
      throw new Error('No token selected. Please run `select-token` first.');
    }

    const targetChainId = config.targetChainId;
    if (!targetChainId) {
      throw new Error('No target chain selected. Please run `select-target-chain` first.');
    }

    // Prompt for amount and permit usage
    const { amount, usePermit } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to lock:',
        validate: (input: string) => {
          const val = Number(input);
          if (isNaN(val) || val <= 0) {
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
      const { wallet } = getProviderAndWallet();
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet.provider);
      const decimals = await tokenContract.decimals();
      // Parse amount as 18 decimals; consider fetching decimals dynamically for accuracy
      const amountWei = ethers.parseUnits(amount, decimals);

      const allowance = await tokenContract.allowance(wallet.address, config.currentNetwork.bridgeFactoryAddress);
      console.log('Allowance:', allowance.toString());

      console.log(`\nLocking ${amount} tokens (${amountWei.toString()} wei) to chain ID ${targetChainId}...`);

      const tx = await lockToken(tokenAddress, amountWei, usePermit, targetChainId);

      console.log(`Transaction sent. Hash: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
    } catch (error) {
      console.error('Error locking tokens:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
