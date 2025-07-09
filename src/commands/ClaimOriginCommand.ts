import { ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { claimToken } from '../utils/BridgeClient';
import { cliConfigManager } from '../config/cliConfig';
import { claimsManager } from '../relayer/ClaimsManager';
import inquirer from 'inquirer';
import { TxLogger } from '../utils/TxLogger';
import { ClaimOriginError } from '../errors/ClaimOriginError';
import { BridgeUtils } from '../utils/BridgeUtils';
import { ClaimType } from '../types';

export class ClaimOriginCommand extends BaseCommand {

  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();
    const { wallet, provider } = BridgeUtils.getProviderAndWallet();

    try {
      BridgeUtils.validateClaimOriginConfig(config);

      const { claimNative } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'claimNative',
          message: 'Do you want to claim native?',
          default: false,
        },
      ]);

      const originalToken = claimNative ? ethers.ZeroAddress : config.originalToken;
      const userAddress = wallet.address.toLowerCase();

      const claim = await claimsManager.getNextUnclaimedClaim(userAddress, ClaimType.BURN);
      if (!claim) {
        console.log('No unclaimed claims found.');
        return;
      }

      const { user, token, amount, nonce, sourceChainId, claimChainId, signature, deadline } = claim;
      const targetChainId = claimChainId;
      const burnChainId = sourceChainId;

      console.log(`Claiming ${amount} tokens to chain ID ${targetChainId}...`);
      const tx = await claimToken(
        user,
        originalToken!,
        Number(amount),
        Number(nonce),
        Number(burnChainId),
        Number(targetChainId),
        Number(deadline),
        signature,
        false
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
        originalToken,
        amount,
        chainId: targetChainId
      });

      await claimsManager.markClaimAsClaimed(userAddress, nonce, claimChainId);

    } catch (error) {
      if (error instanceof ClaimOriginError) {
        console.error('Claim origin error:', error.message);
        throw error;
      }
      console.error('Unexpected error in claim origin:', error instanceof Error ? error.message : error);
      throw new ClaimOriginError(error);
    } finally {
      provider.destroy();
    }
  }
}
