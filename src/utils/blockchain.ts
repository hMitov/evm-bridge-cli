import { ethers, Contract, ContractTransactionResponse } from 'ethers';
import { BridgeConfig, TokenInfo, PermitData } from '../types';
import { ERC20_ABI, BRIDGE_FACTORY_ABI } from '../types/abi';

export const getTokenInfo = async (
  config: BridgeConfig,
  tokenAddress: string
): Promise<TokenInfo> => {
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, config.provider);
  
  const [symbol, decimals, balance] = await Promise.all([
    tokenContract.symbol(),
    tokenContract.decimals(),
    tokenContract.balanceOf(config.wallet.address)
  ]);

  return {
    address: tokenAddress,
    symbol,
    decimals,
    balance: ethers.formatUnits(balance, decimals)
  };
};

export const generatePermitSignature = async (
  config: BridgeConfig,
  tokenAddress: string,
  amount: bigint,
  deadline: bigint
): Promise<PermitData> => {
  const tokenContract = new Contract(tokenAddress, ERC20_ABI, config.provider);
  const nonce = await tokenContract.nonces(config.wallet.address);
  
  const domain = {
    name: await tokenContract.name(),
    version: '1',
    chainId: config.currentNetwork.chainId,
    verifyingContract: tokenAddress
  };

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  };

  const value = {
    owner: config.wallet.address,
    spender: config.currentNetwork.bridgeFactoryAddress,
    value: amount,
    nonce,
    deadline
  };

  const signature = await config.wallet.signTypedData(domain, types, value);
  const { v, r, s } = ethers.Signature.from(signature);

  return {
    owner: config.wallet.address,
    spender: config.currentNetwork.bridgeFactoryAddress,
    value: amount,
    nonce,
    deadline,
    v,
    r,
    s
  };
};

export const lockToken = async (
  config: BridgeConfig,
  tokenAddress: string,
  amount: bigint,
  usePermit: boolean = false
): Promise<ContractTransactionResponse> => {
  const bridgeFactory = new Contract(
    config.currentNetwork.bridgeFactoryAddress,
    BRIDGE_FACTORY_ABI,
    config.wallet
  );

  if (usePermit) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
    const permitData = await generatePermitSignature(config, tokenAddress, amount, deadline);
    
    return bridgeFactory.lockTokenWithPermit(
      tokenAddress,
      amount,
      permitData.deadline,
      permitData.v,
      permitData.r,
      permitData.s
    );
  } else {
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, config.wallet);
    await tokenContract.approve(config.currentNetwork.bridgeFactoryAddress, amount);
    
    return bridgeFactory.lockToken(tokenAddress, amount);
  }
};

export const claimToken = async (
  config: BridgeConfig,
  amount: bigint,
  nonce: bigint,
  sourceChainId: number,
  signature: string,
  isWrapped: boolean
): Promise<ContractTransactionResponse> => {
  const bridgeFactory = new Contract(
    config.currentNetwork.bridgeFactoryAddress,
    BRIDGE_FACTORY_ABI,
    config.wallet
  );

  if (isWrapped) {
    return bridgeFactory.claimWrappedWithSignature(amount, nonce, sourceChainId, signature);
  } else {
    return bridgeFactory.claimOriginalWithSignature(amount, nonce, sourceChainId, signature);
  }
};

export const returnToken = async (
  config: BridgeConfig,
  amount: bigint
): Promise<ContractTransactionResponse> => {
  const bridgeFactory = new Contract(
    config.currentNetwork.bridgeFactoryAddress,
    BRIDGE_FACTORY_ABI,
    config.wallet
  );

  return bridgeFactory.burnWrappedForReturn(amount);
}; 