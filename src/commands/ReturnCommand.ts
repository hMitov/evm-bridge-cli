import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { returnToken } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/config';

function getProviderAndWallet() {
  const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
  const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
  const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
  return { provider, wallet, currentNetwork };
}

export class ReturnCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();

    // Pull these from your config or environment
    const wrappedTokenAddress = config.wrappedToken;
    const targetTokenAddress = config.targetToken;
    const targetChainId = config.targetChainId;
    const nonce = config.nonce;
    const amount = config.amount; // assumed string decimal

    if (!wrappedTokenAddress || !targetTokenAddress) {
      throw new Error('Token addresses are not configured. Please set wrappedToken and targetToken in the config.');
    }
    if (!targetChainId) {
      throw new Error('Target chain ID not configured.');
    }
    if (!nonce) {
      throw new Error('Nonce not configured.');
    }
    if (!amount) {
      throw new Error('Amount not configured.');
    }

    try {
      // Get provider and wallet similarly to your LockCommand
      const currentNetwork = config.currentNetwork;
      const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
      const wallet = new ethers.Wallet(config.userPrivateKey, provider);

      // Fetch token decimals dynamically to parse amount correctly
      const ERC20_ABI = [
        "function decimals() view returns (uint8)"
      ];
      const tokenContract = new ethers.Contract(wrappedTokenAddress, ERC20_ABI, provider);
      const decimals = await tokenContract.decimals();

      const amountWei = ethers.parseUnits(amount, decimals);

      console.log(`Returning ${amount} tokens (${amountWei.toString()} wei) to chain ID ${targetChainId}...`);

      const tx = await returnToken(
        wrappedTokenAddress,
        targetTokenAddress,
        amountWei,
        Number(targetChainId),
        Number(nonce),
        wallet // pass wallet as signer if returnToken needs it
      );

      console.log(`Transaction sent. Hash: ${tx.hash}`);

      const receipt = await tx.wait();

      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    } catch (error) {
      console.error('Error returning tokens:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

