import inquirer from 'inquirer';
import { ethers, Contract } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { cliConfigManager } from '../config/cliConfig';
import { lockToken } from '../utils/blockchain';  // <- import your blockchain helper
import { USER_PRIVATE_KEY } from '../config/config';

// ERC20 ABI snippet needed for permit and decimals
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

export class LockWithPermitCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();

    if (!config.selectedToken) throw new Error('No token selected.');
    if (!config.targetChainId) throw new Error('No target chain selected.');

    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to lock with permit:',
        validate: (input: string) => {
          const val = Number(input);
          if (isNaN(val) || val <= 0) return 'Enter a positive number';
          return true;
        }
      }
    ]);

    try {
      // Get decimals for token to parse amount correctly
      // You can also move this logic inside blockchain.ts if you want
      const { wallet } = getProviderAndWallet();
      const tokenContract = new Contract(config.selectedToken, ERC20_ABI, wallet.provider);
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      // Call your blockchain helper with usePermit = true
      const tx = await lockToken(config.selectedToken, amountWei, true, config.targetChainId);

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber ?? 'unknown'}, gas used: ${receipt?.gasUsed?.toString() ?? 'unknown'}`);
    } catch (error) {
      console.error('Error locking token with permit:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
