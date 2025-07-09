import { ethers } from 'ethers';

export interface NetworkConfig {
  name: string;
  chainId: number;
  wsUrl: string;
  bridgeFactoryAddress: string;
  explorerUrl: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  balance: string;
}

export interface BridgeTransaction {
  type: 'lock' | 'claim' | 'return';
  tokenAddress: string;
  amount: string;
  sourceChainId: number;
  targetChainId: number;
  timestamp: number;
  txHash: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface PermitData {
  owner: string;
  spender: string;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
  v: number;
  r: string;
  s: string;
}

export interface SignedClaim {
  user: string;
  token: string;
  amount: string;
  nonce: string;
  sourceChainId: string;
  claimChainId: string;
  signature: string;
  deadline: string;
  claimed?: boolean;
  claimType?: 'lock' | 'burn';
}

export enum ClaimType {
  LOCK = 'lock',
  BURN = 'burn',
}

export enum EventName {
  TOKEN_LOCKED = 'TokenLocked',
  NATIVE_LOCKED = 'NativeLocked',
  TOKEN_BURNED = 'TokenBurned',
}

export interface CLIConfig {
  currentNetwork: NetworkConfig
  targetChainId?: number;
  originalToken?: string;
}