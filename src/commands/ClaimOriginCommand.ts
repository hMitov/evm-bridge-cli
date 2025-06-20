import { Contract, ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { claimToken } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { claimsManager } from '../relayer/claimsManager'; // Import claimsManager singleton
import { USER_PRIVATE_KEY } from '../config/configLoader';
import { SignedClaim } from '../relayer/claimsManager';
import inquirer from 'inquirer';
import { TxLogger } from '../utils/txLogger';

function getProviderAndWallet() {
    const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
    const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
    const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    return { provider, wallet, currentNetwork };
}

export class ClaimOriginCommand extends BaseCommand {
    protected async action(): Promise<void> {
      const config = cliConfigManager.getCliConfig();

      const { claimNative } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'claimNative',
          message: 'Do you want to claim native?',
          default: false,
        },
      ]);

      const originalToken = claimNative
      ? ethers.ZeroAddress
      : config.originalToken;

      if (!originalToken) {
        throw new Error('No original token selected. Please run `select-token` first.');
      }      

      const { provider, wallet } = getProviderAndWallet();
      const userAddress = wallet.address.toLowerCase();
      
      let claim: SignedClaim | null;
      try {
        claim = await claimsManager.getNextUnclaimedClaim(userAddress, 'burn');
      } catch (error) {
        console.error('Error getting next unclaimed claim:', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    
      if (!claim) {
        console.log('No unclaimed claims found');
        await provider.destroy();
        return;
      }

      const { user, amount, nonce, signature } = claim;
      const targetChainId = cliConfigManager.getCliConfig().currentNetwork.chainId;

      try {
        console.log(`Claiming ${amount} tokens to chain ID ${targetChainId}...`);
        const tx = await claimToken(
          user,
          originalToken!,
          Number(amount),
          Number(nonce),
          Number(targetChainId),
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
        await claimsManager.markClaimAsClaimed(userAddress, nonce);
      } catch (error) {
        console.error('Error claiming tokens:', error instanceof Error ? error.message : 'Unknown error');
        throw error;  
      }
    }
}
