import { BaseCommand } from './BaseCommand';
import { claimToken } from '../utils/BridgeClient';
import { claimsManager } from '../relayer/ClaimsManager';
import { TxLogger } from '../utils/TxLogger';
import { ClaimWrappedError } from '../errors/ClaimWrappedError';
import { BridgeUtils } from '../utils/BridgeUtils';
import { ClaimType } from '../types';

export class ClaimWrappedCommand extends BaseCommand {

  protected async action(): Promise<void> {

    const { wallet, provider } = BridgeUtils.getProviderAndWallet();
    const userAddress = wallet.address.toLowerCase();

    try {
      const claim = await claimsManager.getNextUnclaimedClaim(userAddress, ClaimType.LOCK);
      if (!claim) {
        console.log('No unclaimed claims found.');
        return;
      }

      const { user, token, amount, sourceChainId, nonce, signature } = claim;

      console.log(`Claiming tokens for amount: ${amount}, nonce: ${nonce}, sourceChainId: ${sourceChainId}`);

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
      if (error instanceof ClaimWrappedError) {
        console.error('Claim wrapped error:', error.message);
        throw error;
      }
      console.error('Unexpected error claiming tokens:', error instanceof Error ? error.message : 'Unknown error');
      throw new ClaimWrappedError(error);
    } finally {
      provider.destroy();
    }
  }
}
