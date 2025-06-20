import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { claimToken } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { claimsManager } from '../relayer/claimsManager'; // Import claimsManager singleton
import { USER_PRIVATE_KEY } from '../config/configLoader';
import { SignedClaim } from '../relayer/claimsManager';
import { TxLogger } from '../utils/txLogger';

function getProviderAndWallet() {
  const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
  const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
  const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
  return { provider, wallet, currentNetwork };
}

export class ClaimWrappedCommand extends BaseCommand {
  protected async action(): Promise<void> {
    const { wallet, provider } = getProviderAndWallet();
    const userAddress = wallet.address.toLowerCase();
  

    let claim: SignedClaim | null;
    try {
      claim = await claimsManager.getNextUnclaimedClaim(userAddress, 'lock');
    } catch (error) {
      console.error('Error getting next unclaimed claim:', error instanceof Error ? error.message : 'Unknown error');
      await provider.destroy();
      throw error;
    }

    if (!claim) {
      console.log('No unclaimed claims found');
      return;
    }

    const { user, token, amount, sourceChainId, nonce, signature } = claim;


    console.log(`Claiming tokens for amount: ${amount}, nonce: ${nonce}, sourceChainId: ${sourceChainId}`);

    try {
      const tx = await claimToken(
        user,
        token,
        Number(amount),
        Number(nonce),
        Number(sourceChainId),
        signature,
        true
      );

      console.log(`Transaction hash: ${tx.hash}`);

      const receipt = await tx.wait();

      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

      TxLogger.logTransaction({
        command: 'claim',
        hash: tx.hash,
        blockNumber: receipt?.blockNumber,
        from: tx.from,
        to: tx.to,
        gasUsed: receipt?.gasUsed?.toString(),
        user,
        token,
        amount: amount.toString(),
        chainId: sourceChainId.toString()
      });

      await claimsManager.markClaimAsClaimed(userAddress, nonce);
    } catch (error) {
      console.error('Error claiming tokens:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
