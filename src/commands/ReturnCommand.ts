import { Contract, ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { returnToken } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/config';
import inquirer from 'inquirer';
import { getNetworkByChainId } from '../config/networks';
import * as werc20Abi from '../contracts/abis/WERC20.json';

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

export class ReturnCommand extends BaseCommand {
  private validateAddress(input: string): boolean | string {
    return ethers.isAddress(input) ? true : 'Please enter a valid WERC20 address';
  }

  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();

    // Pull these from your config or environment
    const { wrappedTokenAddress } = await inquirer.prompt([
      {
        type: 'input',
        name: 'wrappedTokenAddress',
        message: 'Enter WERC20 contract address:',
        validate: this.validateAddress,
      },
    ]);
    
    const targetTokenAddress = config.selectedToken;
    const targetChainId = config.targetChainId;  // This is the chain where we want to receive the original token
    
    // Prompt for amount
    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to return:',
        validate: (input: string) => {
          const val = Number(input);
          if (isNaN(val) || val <= 0) {
            return 'Please enter a valid positive number';
          }
          return true;
        }
      }
    ]);

    console.log("\nTransaction Details:");
    console.log("-------------------");
    console.log("Current Network (where wrapped token exists):", config.currentNetwork.name);
    console.log("Current Chain ID:", config.currentNetwork.chainId);
    console.log("Target Network (where original token will be received):", getNetworkByChainId(targetChainId!).name);
    console.log("Target Chain ID:", targetChainId);
    console.log("Wrapped Token Address:", wrappedTokenAddress);
    console.log("Original Token Address:", targetTokenAddress);
    console.log("Amount to Return:", amount);

    try {
      // Get provider and wallet for the network where we need to burn the wrapped tokens (Sepolia)
      const targetNetwork = getNetworkByChainId(config.targetChainId!);
      const provider = new ethers.WebSocketProvider(targetNetwork.wsUrl);
      const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);

      // First check if the contract exists
      const code = await provider.getCode(wrappedTokenAddress);
      if (code === '0x') {
        throw new Error('No contract found at the specified address');
      }

      // Try to get the decimals directly from the contract
      const tokenContract = new Contract(
        wrappedTokenAddress,
        ['function decimals() view returns (uint8)'],
        wallet.provider
      );

      try {
        const decimals = await tokenContract.decimals();
        const amountWei = ethers.parseUnits(amount, decimals);

        console.log(`\nBurning ${amount} wrapped tokens on Sepolia (${amountWei.toString()} wei) to return to Base...`);

        const tx = await returnToken(
          wrappedTokenAddress,
          targetTokenAddress!,
          amountWei,
          config.targetChainId!,  // This is Sepolia where we need to burn the wrapped tokens
          wallet,
        );

        console.log(`Transaction sent. Hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
        console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
      } catch (error) {
        console.error('Failed to get decimals:', error);
        // If decimals() fails, try with 18 decimals as a fallback
        console.log('Falling back to 18 decimals...');
        const amountWei = ethers.parseUnits(amount, 18);
        
        const tx = await returnToken(
          wrappedTokenAddress,
          targetTokenAddress!,
          amountWei,
          config.targetChainId!,  // This is Sepolia where we need to burn the wrapped tokens
          wallet,
        );

        console.log(`Transaction sent. Hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
        console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
      }
    } catch (error) {
      console.error('Error returning tokens:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

