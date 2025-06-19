import { Contract, ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { burnToken } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/config';
import inquirer from 'inquirer';
import { getNetworkByChainId } from '../config/networks';
import * as werc20Abi from '../contracts/abis/WERC20.json';
import { TxLogger } from '../utils/txLogger';

export class BurnTokenCommand extends BaseCommand {
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
    
    const originalTokenAddress = config.selectedToken;
    const originalChainId = config.currentNetwork.chainId;  // This is the chain where we want to receive the original token
    
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
    console.log("Original Network (where original token will be received):", getNetworkByChainId(originalChainId!).name);
    console.log("Original Chain ID:", originalChainId);
    console.log("Wrapped Token Address:", wrappedTokenAddress);
    console.log("Original Token Address:", originalTokenAddress);
    console.log("Amount to Return:", amount);

    try {
      // Get provider and wallet for the network where we need to burn the wrapped tokens (Sepolia)
      const targetNetwork = getNetworkByChainId(config.targetChainId!);
      console.log("Target Network: ", targetNetwork);
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
        werc20Abi.abi,
        wallet.provider
      );

        const decimals = await tokenContract.decimals();
        const amountWei = ethers.parseUnits(amount, decimals);

        console.log(`\nBurning ${amount} wrapped tokens on Sepolia (${amountWei.toString()} wei) to return to Base...`);

        const tx = await burnToken(
          wrappedTokenAddress,
          originalTokenAddress!,
          amountWei,
          Number(originalChainId),
          wallet,
        );

        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
        console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
        
        // Log transaction to common file
        TxLogger.logTransaction({
          command: 'burn',
          hash: tx.hash,
          blockNumber: receipt?.blockNumber,
          from: tx.from,
          to: tx.to,
          gasUsed: receipt?.gasUsed?.toString(),
          wrappedTokenAddress,
          originalTokenAddress,
          amount: amountWei.toString(),
          chainId: Number(originalChainId),
        });

    } catch (error) {
      console.error('Error returning tokens:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

