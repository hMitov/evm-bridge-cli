import inquirer from 'inquirer';
import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { cliConfigManager } from '../config/cliConfig';
import { lockNative } from '../utils/blockchain';
import { USER_PRIVATE_KEY } from '../config/configLoader';
import { TxLogger } from '../utils/txLogger';

function getProviderAndWallet() {
    const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
    const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
    const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    return { provider, wallet, currentNetwork };
}

export class LockNativeCommand extends BaseCommand {

  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();

    if (!config.targetChainId) {
      throw new Error('No target chain selected.');
    }

    const { amount } = await inquirer.prompt<{ 
      amount: string 
    }>([ 
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount of native ETH to lock:',
        validate: (input: string) => {
          const val = Number(input);
          if (isNaN(val) || val <= 0) return 'Enter a positive number';
          return true;
        },
      },
    ]);

    const { provider } = getProviderAndWallet();

    try {
      const amountWei = ethers.parseEther(amount);

      console.log(`\nLocking ${amount} native ETH (${amountWei.toString()} wei) to chain ID ${config.targetChainId}...`);

      const tx = await lockNative(amountWei, config.targetChainId);
      
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
      console.error('Error locking native ETH:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
