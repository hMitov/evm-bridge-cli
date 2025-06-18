import inquirer from 'inquirer';
import { ethers, Contract } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { cliConfigManager } from '../config/cliConfig';
import { lockNative, lockToken } from '../utils/blockchain';  // <- import your blockchain helper
import { USER_PRIVATE_KEY } from '../config/config';
import werc20Abi from '../contracts/abis/WERC20.json';

function getProviderAndWallet() {
    const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
    const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
    const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    return { provider, wallet, currentNetwork };
}

export class LockNativeCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();

    if (!config.targetChainId) throw new Error('No target chain selected.');

    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount of native ETH to lock:',
        validate: (input: string) => {
          const val = Number(input);
          if (isNaN(val) || val <= 0) return 'Enter a positive number';
          return true;
        }
      }
    ]);

    try {
      const amountWei = ethers.parseEther(amount);

      const tx = await lockNative(amountWei, config.targetChainId);
      console.log("Transaction sent:", tx);

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber ?? 'unknown'}, gas used: ${receipt?.gasUsed?.toString() ?? 'unknown'}`);
    } catch (error) {
      console.error('Error locking native ETH:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
