import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { cliConfigManager } from '../config/cliConfig';
import { lockNative } from '../utils/BridgeClient';
import { TxLogger } from '../utils/TxLogger';
import { LockNativeError } from '../errors/LockNativeError';
import { BridgeUtils } from '../utils/BridgeUtils';
import { ERROR_MESSAGES } from '../errors/messages/errorMessages';

export class LockNativeCommand extends BaseCommand {

  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();

    if (!config.targetChainId) {
      throw new LockNativeError(ERROR_MESSAGES.TARGET_NETWORK_NOT_FOUND);
    }
    const targetChainId = config.targetChainId;

    const { amount } = await inquirer.prompt<{ 
      amount: string 
    }>([ 
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount of native ETH to lock:',
        validate: BridgeUtils.validateAmount,
      },
    ]);

    try {
      const amountWei = ethers.parseEther(amount);

      console.log(`\nLocking ${amount} native ETH (${amountWei.toString()} wei) to chain ID ${targetChainId}...`);

      const tx = await lockNative(amountWei, targetChainId);
      
      console.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

      TxLogger.logTransaction({
        command: 'lockNative',
        hash: tx.hash,
        blockNumber: receipt?.blockNumber,
        from: tx.from,
        to: tx.to,
        gasUsed: receipt?.gasUsed?.toString(),
        amount: amountWei.toString(),
        chainId: config.currentNetwork.chainId,
      });
    } catch (error) {
      if (error instanceof LockNativeError) {
        console.error('Lock native error:', error.message);
        throw error;
      }
      console.error('Unexpected error locking native ETH:', error instanceof Error ? error.message : error);
      throw new LockNativeError(error);
    }
  }
}
