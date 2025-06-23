import { ethers, Contract } from "ethers";
import { BaseCommand } from "./BaseCommand";
import { burnToken } from '../utils/BridgeClient';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/configLoader';
import inquirer from 'inquirer';
import werc20Abi from '../contracts/abis/WERC20.json';
import { TxLogger } from '../utils/TxLogger';
import { getNetworkConfigByChainId } from '../config/networks';
import { NetworkConfig } from '../types';
import { BurnTokenError } from './../errors/BurnTokenError';
import { BridgeUtils } from '../utils/BridgeUtils';
import { ERROR_MESSAGES } from "../errors/messages/errorMessages";

export class BurnTokenCommand extends BaseCommand {

  protected async action(): Promise<void> {
    const config = cliConfigManager.getCliConfig();
    let provider: ethers.WebSocketProvider | null = null;

    try {
      BridgeUtils.validateBurnTokenConfig(config);

      const { wrappedTokenAddress } = await inquirer.prompt<{
        wrappedTokenAddress: string
      }>([
        {
          type: 'input',
          name: 'wrappedTokenAddress',
          message: 'Enter WERC20 contract address:',
          validate: BridgeUtils.validateAddress,
        },
      ]);

      const { burnWrappedNativeTokens } = await inquirer.prompt<{
        burnWrappedNativeTokens: boolean
      }>([
        {
          type: 'confirm',
          name: 'burnWrappedNativeTokens',
          message: 'Do you want to burn wrapped native tokens?',
          default: false,
        },
      ]);

      const originalTokenAddress = burnWrappedNativeTokens ? ethers.ZeroAddress : config.originalToken;
      const originalChainId = config.currentNetwork.chainId;
      const targetNetwork: NetworkConfig | undefined = getNetworkConfigByChainId(config.targetChainId!);

      if (!targetNetwork) {
        throw new BurnTokenError(ERROR_MESSAGES.TARGET_NETWORK_NOT_FOUND);
      }

      const { amount } = await inquirer.prompt<{
        amount: string
      }>([
        {
          type: 'input',
          name: 'amount',
          message: 'Enter amount to return:',
          validate: BridgeUtils.validateAmount,
        },
      ]);

      provider = new ethers.WebSocketProvider(targetNetwork.wsUrl);
      const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);

      await BridgeUtils.verifyContractExists(provider, wrappedTokenAddress);

      const tokenContract = new Contract(wrappedTokenAddress, werc20Abi.abi, wallet.provider);

      const balance = await tokenContract.balanceOf(wallet.address);
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      if (amountWei > balance) {
        throw new BurnTokenError(ERROR_MESSAGES.AMOUNT_EXCEEDS_BALANCE);
      }

      console.log(`\nBurning ${amount} wrapped tokens on Sepolia (${amountWei.toString()} wei) to return to Base...`);

      const tx = await burnToken(
        wrappedTokenAddress,
        originalTokenAddress!,
        amountWei,
        originalChainId,
        wallet,
      );

      const receipt = await tx.wait();

      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);

      TxLogger.logTransaction({
        command: 'burn',
        hash: tx.hash,
        blockNumber: receipt?.blockNumber,
        from: tx.from,
        to: tx.to,
        gasUsed: receipt?.gasUsed?.toString(),
        wrappedTokenAddress,
        originalTokenAddress,
        amount: amountWei.toString(),
        chainId: originalChainId.toString(),
      });

    } catch (error) {
      if (error instanceof BurnTokenError) {
        console.error('Error returning tokens:', error.message);
        throw error;
      }
      console.error('Unexpected error returning tokens:', error instanceof Error ? error.message : error);
      throw new BurnTokenError(error);
    }
  }
}

