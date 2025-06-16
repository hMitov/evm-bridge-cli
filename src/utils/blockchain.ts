import { ethers, Contract, ContractTransactionResponse } from 'ethers';
import * as bridgeFactoryAbi from '../contracts/abis/BridgeFactory.json';
import * as werc20Abi from '../contracts/abis/WERC20.json';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/config';
import { PermitData, TokenInfo } from '../types';


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

export const getTokenInfo = async (
  tokenAddress: string
): Promise<TokenInfo> => {
  const { wallet, currentNetwork } = getProviderAndWallet();
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet.provider);

  try {
    const [symbol, decimals, balance] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals(),
      tokenContract.balanceOf(wallet.address),
    ]);

    const allowance = await tokenContract.allowance(wallet.address, currentNetwork.bridgeFactoryAddress);

    console.log('Token address:', tokenAddress);
    console.log('Wallet address:', wallet.address);
    console.log('Bridge address:', currentNetwork.bridgeFactoryAddress);
    console.log('Balance:', ethers.formatUnits(balance, decimals));
    console.log('Allowance:', ethers.formatUnits(allowance, decimals));
    console.log('Decimals:', decimals);

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


export const generatePermitSignature = async (
  tokenAddress: string,
  amount: bigint,
  deadline: bigint
): Promise<PermitData> => {
  const { wallet, currentNetwork } = getProviderAndWallet();
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet.provider);

  try {
    const nonce = await tokenContract.nonces(wallet.address);

    const domain = {
      name: await tokenContract.name(),
      version: '1',
      chainId: currentNetwork.chainId,
      verifyingContract: tokenAddress,
    };

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    const value = {
      owner: wallet.address,
      spender: currentNetwork.bridgeFactoryAddress,
      value: amount,
      nonce,
      deadline,
    };

    const signature = await wallet.signTypedData(domain, types, value);
    const { v, r, s } = ethers.Signature.from(signature);

    return { owner: wallet.address, spender: currentNetwork.bridgeFactoryAddress, value: amount, nonce, deadline, v, r, s };
  } catch (error) {
    throw new Error(`Permit signature generation failed: ${(error as Error).message}`);
  }
};

export const lockToken = async (
  tokenAddress: string,
  amount: bigint,           // amount in smallest units (wei)
  usePermit: boolean = false,
  targetChainId: number,
): Promise<ContractTransactionResponse> => {

  const { wallet, currentNetwork } = getProviderAndWallet();
  const bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);
  const nonce = Date.now();

  const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);

  if (usePermit) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
    const permitData = await generatePermitSignature(tokenAddress, amount, deadline);

    return bridgeFactory.lockTokenWithPermit(
      tokenAddress,
      amount,
      targetChainId,
      nonce,
      permitData.deadline,
      permitData.v,
      permitData.r,
      permitData.s
    );
  } else {
    const approveTx = await tokenContract.approve(currentNetwork.bridgeFactoryAddress, amount);
    await approveTx.wait();

    const allowance = await tokenContract.allowance(wallet.address, currentNetwork.bridgeFactoryAddress);
    if (allowance < amount) {
      throw new Error('Approval not confirmed on-chain!');
    }

    return bridgeFactory.lockToken(tokenAddress, amount, targetChainId, nonce);
  }
};


export const claimToken = async (
  userAddress: string,
  tokenAddress: string,
  amount: bigint,
  nonce: bigint,
  sourceChainId: number,
  signature: string,
  isWrapped: boolean
): Promise<ContractTransactionResponse> => {
  const { wallet, currentNetwork } = getProviderAndWallet();
  const bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);

  if (isWrapped) {
    return bridgeFactory.claimWrappedWithSignature(
      userAddress,
      tokenAddress,
      amount,
      nonce,
      sourceChainId,
      signature
    );
  } else {
    return bridgeFactory.claimOriginalWithSignature(
      userAddress,
      tokenAddress,
      amount,
      nonce,
      sourceChainId,
      signature
    );
  }
};

export const returnToken = async (
  wrappedTokenAddress: string,
  originalTokenAddress: string,
  amount: bigint,
  targetChainId: number,
  nonce: number
): Promise<ContractTransactionResponse> => {
  const { wallet, currentNetwork } = getProviderAndWallet();
  const bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);

  return bridgeFactory.burnWrappedForReturn(wrappedTokenAddress, originalTokenAddress, amount, targetChainId, nonce);
};
