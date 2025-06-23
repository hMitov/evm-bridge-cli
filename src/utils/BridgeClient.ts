import { ethers, Contract, ContractTransactionResponse, Signature } from 'ethers';
import * as bridgeFactoryAbi from '../contracts/abis/BridgeFactory.json';
import werc20Abi from '../contracts/abis/WERC20.json';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/configLoader';
import { TokenInfo } from '../types';
import { getNetworkConfigByChainId } from '../config/networks';
import { BridgeUtils } from './BridgeUtils';
import { BridgeClientError } from '../errors/BridgeClientError';
import { ERROR_MESSAGES } from '../errors/messages/errorMessages';

export const getTokenInfo = async (
  tokenAddress: string
): Promise<TokenInfo> => {
  const { wallet, currentNetwork } = BridgeUtils.getProviderAndWallet();
  const tokenContract = new Contract(tokenAddress, werc20Abi.abi, wallet.provider);

  try {
    const [symbol, decimals, balance] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals(),
      tokenContract.balanceOf(wallet.address),
    ]);

    const allowance = await tokenContract.allowance(wallet.address, currentNetwork.bridgeFactoryAddress);

    console.log(`
      Token Info:
        Token address: ${tokenAddress}
        Wallet address: ${wallet.address}
        Bridge address: ${currentNetwork.bridgeFactoryAddress}
        Balance: ${ethers.formatUnits(balance, decimals)}
        Allowance: ${ethers.formatUnits(allowance, decimals)}
        Decimals: ${decimals}
      `);

    return {
      address: tokenAddress,
      symbol,
      decimals,
      balance: ethers.formatUnits(balance, decimals),
    };
  } catch (error) {
    throw new BridgeClientError(error);
  }
};

export const lockToken = async (
  tokenAddress: string,
  amount: bigint,
  usePermit: boolean = false,
  targetChainId: number,
): Promise<ContractTransactionResponse> => {
  const { wallet, currentNetwork } = BridgeUtils.getProviderAndWallet();
  const bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);
  const tokenContract = new Contract(tokenAddress, werc20Abi.abi, wallet);

  const nonce = Date.now();

  try {
    if (usePermit) {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const { v, r, s } = await BridgeUtils.generatePermitSignature(tokenAddress, wallet, currentNetwork.bridgeFactoryAddress, amount, deadline);
      return bridgeFactory.lockTokenWithPermit(tokenAddress, amount, targetChainId, nonce, deadline, v, r, s);
    } else {
      const approveTx = await tokenContract.approve(currentNetwork.bridgeFactoryAddress, amount);
      await approveTx.wait();

      const allowance = await tokenContract.allowance(wallet.address, currentNetwork.bridgeFactoryAddress);
      if (allowance < amount) throw new BridgeClientError(ERROR_MESSAGES.APPROVAL_NOT_CONFIRMED_ON_CHAIN);

      return bridgeFactory.lockToken(tokenAddress, amount, targetChainId, nonce);
    }
  } catch (error) {
    throw new BridgeClientError(error);
  }
};

export const lockNative = async (
  amount: bigint,
  targetChainId: number
): Promise<ContractTransactionResponse> => {
  if (amount <= 0n) throw new BridgeClientError(ERROR_MESSAGES.AMOUNT_MUST_BE_GREATER_THAN_ZERO);

  const { wallet, currentNetwork } = BridgeUtils.getProviderAndWallet();
  const bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);
  const nonce = Date.now();

  try {
    console.log(`Locking native ETH: amount=${amount.toString()}, targetChainId=${targetChainId}, nonce=${nonce}`);

    const tx = await bridgeFactory.lockNative(targetChainId, nonce, { value: amount });

    console.log(`Lock transaction sent. Hash: ${tx.hash}`);

    return tx;
  } catch (error) {
    throw new BridgeClientError(error);
  }
};

export const claimToken = async (
  userAddress: string,
  tokenAddress: string,
  amount: number,
  nonce: number,
  chainId: number,
  signature: string,
  becomeWrapped: boolean
): Promise<ContractTransactionResponse> => {
  try {
    console.log("Claiming token with parameters:", {
      userAddress,
      tokenAddress,
      amount: amount.toString,
      nonce: nonce.toString,
      chainId,
      becomeWrapped,
    });

    const targetChainId = becomeWrapped
      ? cliConfigManager.getCliConfig().targetChainId!
      : chainId;

    const targetNetwork = getNetworkConfigByChainId(targetChainId);
    const provider = new ethers.WebSocketProvider(targetNetwork.wsUrl);
    const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);

    const bridgeFactory = new Contract(targetNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);

    let tx: ContractTransactionResponse;

    if (becomeWrapped) {
      tx = await bridgeFactory.claimWrappedWithSignature(userAddress, tokenAddress, amount, nonce, chainId, signature);
    } else {
      tx = await bridgeFactory.claimOriginalWithSignature(userAddress, tokenAddress, amount, nonce, chainId, signature);
    }

    console.log(`Claim transaction sent. Hash: ${tx.hash}`);

    return tx;
  } catch (error) {
    throw new BridgeClientError(error);
  }
};

export async function burnToken(
  wrappedTokenAddress: string,
  originalTokenAddress: string,
  amount: bigint,
  originalChainId: number,
  wallet: ethers.Wallet
): Promise<ethers.TransactionResponse> {
  try {
    const targetChainId = cliConfigManager.getCliConfig().targetChainId!;
    const targetNetwork = getNetworkConfigByChainId(targetChainId);
    const bridgeFactory = new Contract(targetNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);

    const nonce = Date.now();

    console.log(`
      Nonce: ${nonce}
      Wrapped Token Address: ${wrappedTokenAddress}
      Original Token Address: ${originalTokenAddress}
      Amount: ${amount.toString()}
      Original Chain ID: ${originalChainId}
      Wallet: ${wallet.address}
      --------------------------------
      `);

    const tx = await bridgeFactory.burnWrappedForReturn(
      wrappedTokenAddress,
      originalTokenAddress,
      amount.toString(),
      originalChainId.toString(),
      nonce.toString()
    );

    console.log(`Transaction sent! Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    return tx;
  } catch (error) {
    throw new BridgeClientError(error);
  }
}
