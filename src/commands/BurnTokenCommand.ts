import { Contract, ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { burnToken } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/configLoader';
import inquirer from 'inquirer';
import * as werc20Abi from '../contracts/abis/WERC20.json';
import { TxLogger } from '../utils/txLogger';
import { getNetworkConfigByChainId } from '../config/networks';
import { NetworkConfig } from '../types';

export class BurnTokenCommand extends BaseCommand {
  private validateAddress(input: string): boolean | string {
    return ethers.isAddress(input) ? true : 'Please enter a valid WERC20 address';
  }

  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();

    const { wrappedTokenAddress } = await inquirer.prompt<{ 
      wrappedTokenAddress: string 
    }>([
      {
        type: 'input',
        name: 'wrappedTokenAddress',
        message: 'Enter WERC20 contract address:',
        validate: this.validateAddress,
      },
    ]);

    const { burnWrappedNativeTokens } = await inquirer.prompt<{ 
      burnWrappedNativeTokens: boolean 
    }>([
      {
        type: 'confirm',
        name: 'burnWrappedNativeTokens',
        message: 'Do you want to burn wrapped native tokens?',
        default: false,
      },
    ]);
    
    
    const originalTokenAddress = burnWrappedNativeTokens
      ? ethers.ZeroAddress
      : config.originalToken;
    
    if (!originalTokenAddress) {
      throw new Error('Original token address not found in config. Please run `select-token`.');
    }

    const originalChainId = config.currentNetwork.chainId;

    if (!originalChainId) {
      throw new Error('Original chain ID missing from config.');
    }

    const { amount } = await inquirer.prompt<{ 
      amount: string 
    }>([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to return:',
        validate: (input: string): boolean | string => {
          const val = Number(input);
          return val > 0 && !isNaN(val) ? true : 'Please enter a valid positive number';
        },
      },
    ]);

    const targetNetwork: NetworkConfig | undefined = getNetworkConfigByChainId(config.targetChainId!);
    if (!targetNetwork) {
      throw new Error('Target network not found in config. Please run `select-target-chain`.');
    }      

    const provider = new ethers.WebSocketProvider(targetNetwork.wsUrl);
    const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    
    try {
      const code = await provider.getCode(wrappedTokenAddress);
      if (code === '0x') {
        throw new Error('No contract found at the specified address');
      }

      const tokenContract = new Contract(wrappedTokenAddress, werc20Abi.abi, wallet.provider);

      const balance = await tokenContract.balanceOf(wallet.address);
      const decimals = await tokenContract.decimals();

      console.log(`Balance: ${ethers.formatUnits(balance, decimals)}`);
      console.log(`Decimals: ${decimals}`);

      const amountWei = ethers.parseUnits(amount, decimals);

      if (amountWei > balance) {
        throw new Error('Entered amount exceeds wallet balance.');
      }

      console.log(`\nBurning ${amount} wrapped tokens on Sepolia (${amountWei.toString()} wei) to return to Base...`);

      const tx = await burnToken(
        wrappedTokenAddress,
        originalTokenAddress!,
        amountWei,
        originalChainId,
        wallet,
      );

      const receipt = await tx.wait();

      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
        
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
        chainId: originalChainId.toString(),
      });

    } catch (error) {
      console.error('Error returning tokens:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

