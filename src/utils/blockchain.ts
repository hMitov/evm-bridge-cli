import { ethers, Contract, ContractTransactionResponse, Signature } from 'ethers';
import * as bridgeFactoryAbi from '../contracts/abis/BridgeFactory.json';
import * as werc20Abi from '../contracts/abis/WERC20.json';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/configLoader';
import { TokenInfo } from '../types';
import { getNetworkConfigByChainId } from '../config/networks';

function getProviderAndWallet() {
  const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
  const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
  const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
  return { provider, wallet, currentNetwork };
}

export const getTokenInfo = async (
  tokenAddress: string
): Promise<TokenInfo> => {
  const { wallet, currentNetwork } = getProviderAndWallet();
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
    throw new Error(`Failed to get token info: ${(error as Error).message}`);
  }
};


async function generatePermitSignature(
  tokenAddress: string,
  wallet: ethers.Wallet,
  spender: string,
  amount: ethers.BigNumberish,
  deadline: ethers.BigNumberish
) {
  const tokenContract = new ethers.Contract(tokenAddress, werc20Abi.abi, wallet);

  const onChainDomainSeparator = await tokenContract.DOMAIN_SEPARATOR();
  const name = await tokenContract.name();
  const nonce = await tokenContract.nonces(wallet.address);
  const chainId = (await wallet.provider!.getNetwork()).chainId;

  const domain = {
    name,
    version: "2",
    chainId,
    verifyingContract: tokenAddress,
  };

  const offChainDomainSeparator = ethers.TypedDataEncoder.hashDomain(domain);

  if (onChainDomainSeparator !== offChainDomainSeparator) {
    console.error("Domain separator mismatch! Check token name, version, chainId, and verifyingContract.");
  }

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const value = {
    owner: wallet.address,
    spender,
    value: amount.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };

  const signature = await wallet.signTypedData(domain, types, value);
  const sig = Signature.from(signature);
  const { v, r, s } = sig;

  const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
  if (recoveredAddress.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error("Signature verification failed");
  }

  return { v, r, s };
}

export const lockToken = async (
  tokenAddress: string,
  amount: bigint,
  usePermit: boolean = false,
  targetChainId: number,
): Promise<ContractTransactionResponse> => {
  const { wallet, currentNetwork } = getProviderAndWallet();
  const bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);
  const tokenContract = new Contract(tokenAddress, werc20Abi.abi, wallet);

  const nonce = Date.now();

  if (usePermit) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const { v, r, s } = await generatePermitSignature(tokenAddress, wallet, currentNetwork.bridgeFactoryAddress, amount, deadline);
    return bridgeFactory.lockTokenWithPermit(tokenAddress, amount, targetChainId, nonce, deadline, v, r, s);
  } else {
    const approveTx = await tokenContract.approve(currentNetwork.bridgeFactoryAddress, amount);
    await approveTx.wait();

    const allowance = await tokenContract.allowance(wallet.address, currentNetwork.bridgeFactoryAddress);
    if (allowance < amount) throw new Error('Approval not confirmed on-chain!');

    return bridgeFactory.lockToken(tokenAddress, amount, targetChainId, nonce);
  }
};

export const lockNative = async (
  amount: bigint,
  targetChainId: number
): Promise<ContractTransactionResponse> => {
  if (amount <= 0n) throw new Error('Amount must be > 0');

  const { wallet, currentNetwork } = getProviderAndWallet();
  const bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);
  const nonce = Date.now();

  console.log(`Locking native ETH: amount=${amount.toString()}, targetChainId=${targetChainId}, nonce=${nonce}`);

  const tx = await bridgeFactory.lockNative(targetChainId, nonce, { value: amount });
  return tx;
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
    console.error('Error during claimToken:', error);
    throw error;
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
    console.error('Error in returnToken:', error);
    throw error;
  }
}
