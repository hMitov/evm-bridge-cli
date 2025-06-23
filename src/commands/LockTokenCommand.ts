import inquirer from 'inquirer';
import { ethers, Contract } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { lockToken } from '../utils/BridgeClient';
import { cliConfigManager } from '../config/cliConfig';
import werc20Abi from '../contracts/abis/WERC20.json';
import { TxLogger } from '../utils/TxLogger';
import { LockTokenError } from '../errors/LockTokenError';
import { BridgeUtils } from '../utils/BridgeUtils';

export class LockTokenCommand extends BaseCommand {

  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();
    const { wallet, provider } = BridgeUtils.getProviderAndWallet();

    try {
      BridgeUtils.validateLockTokenConfig(config);

      const { amount, usePermit } = await inquirer.prompt<{
        amount: string;
        usePermit: boolean
      }>([
        {
          type: 'input',
          name: 'amount',
          message: 'Enter amount to lock:',
          validate: BridgeUtils.validateAmount,
        },
        {
          type: 'confirm',
          name: 'usePermit',
          message: 'Use permit for gas-efficient approval?',
          default: false
        },
      ]);

      const tokenAddress = config.originalToken;
      const targetChainId = config.targetChainId;
      const currentChainId = config.currentNetwork.chainId;

      const tokenContract = new Contract(tokenAddress!, werc20Abi.abi, wallet.provider);

      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      console.log(`\nLocking ${amount} tokens (${amountWei.toString()} wei) to chain ID ${targetChainId}...`);

      const tx = await lockToken(tokenAddress!, amountWei, usePermit, targetChainId!);

      console.log(`Transaction sent. Hash: ${tx.hash}`);

      const receipt = await tx.wait();

      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

      TxLogger.logTransaction({
        command: 'lock',
        hash: tx.hash,
        blockNumber: receipt?.blockNumber,
        from: tx.from,
        to: tx.to,
        gasUsed: receipt?.gasUsed?.toString(),
        tokenAddress,
        amount: amountWei.toString(),
        chainId: currentChainId,
      });

    } catch (error) {
      if (error instanceof LockTokenError) {
        console.error('Lock token error:', error.message);
        throw error;
      }
      console.error('Unexpected error locking tokens:', error instanceof Error ? error.message : error);
      throw new LockTokenError(error);
    } finally { 
      provider.destroy();
    }
  }
}
