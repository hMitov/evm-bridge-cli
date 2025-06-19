import { Contract, ethers } from 'ethers';
import { BaseCommand } from './BaseCommand';
import { claimToken } from '../utils/blockchain';
import { cliConfigManager } from '../config/cliConfig';
import { claimsManager } from '../relayer/claimsManager'; // Import claimsManager singleton
import { USER_PRIVATE_KEY } from '../config/config';
import { SignedClaim } from '../relayer/claimsManager';
import inquirer from 'inquirer';
import { getNetworkByChainId } from '../config/networks';
import * as werc20Abi from '../contracts/abis/WERC20.json';
import { TxLogger } from '../utils/txLogger';

function getProviderAndWallet() {
    const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
    const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
    const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    return { provider, wallet, currentNetwork };
}


export class ClaimOriginCommand extends BaseCommand {
    protected async action(): Promise<void> {

      const { claimNative } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'claimNative',
          message: 'Do you want to claim native?',
          default: false,
        },
      ]);

      let originalToken;
      if(claimNative) {
        originalToken = "0x0000000000000000000000000000000000000000";
      } else {
        originalToken = cliConfigManager.getCliConfig().originalToken;
      }

        const { wallet } = getProviderAndWallet();
        const userAddress = wallet.address.toLowerCase();
      
    
        const claim: SignedClaim | null = await claimsManager.getNextUnclaimedClaim(userAddress, 'burn');
        console.log('DEBUG: claim', claim);
    
        if (!claim) {
          console.log('No unclaimed claims found');
          return;
        }


    
        const { user, amount, nonce, signature } = claim;

        
        const targetChainId = cliConfigManager.getCliConfig().currentNetwork.chainId;
        console.log("Claiming original token");
        console.log("User Address:", user);
        console.log("Original Token Address:", originalToken);
        console.log("Amount:", amount);
        console.log("Target Chain ID:", targetChainId);
        console.log("Signature:", signature);
    
        // const amountFormatted = ethers.formatUnits(amount, 18); // Adjust decimals dynamically if needed
    
        // console.log(`Claiming tokens for amount: ${amountFormatted}, nonce: ${nonce}, sourceChainId: ${sourceChainId}`);

        try {
          console.log('\nClaiming tokens...');
    
          const tx = await claimToken(
            user,
            originalToken!,
            Number(amount),
            Number(nonce),
            Number(targetChainId),
            signature,
            false
          );
    
          console.log('DEBUG: tx', tx);
    
          console.log(`Transaction hash: ${tx.hash}`);
          const receipt = await tx.wait();
          console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
          console.log(`Gas used: ${receipt?.gasUsed.toString()}`);
    
          // Log transaction to common file
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
            chainId: getNetworkByChainId(Number(targetChainId)).chainId,
          });
        //   await claimsManager.markClaimAsClaimed(userAddress, nonce);
        } catch (error) {
          console.error('Error claiming tokens:', error instanceof Error ? error.message : 'Unknown error');
          throw error;
        }
      }
}
