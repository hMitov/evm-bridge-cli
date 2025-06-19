import { ethers, Contract, ContractTransactionResponse, Signature } from 'ethers';
import * as bridgeFactoryAbi from '../contracts/abis/BridgeFactory.json';
import * as werc20Abi from '../contracts/abis/WERC20.json';
import { cliConfigManager } from '../config/cliConfig';
import { USER_PRIVATE_KEY } from '../config/config';
import { PermitData, TokenInfo } from '../types';
import { networks } from '../config/networks';
import { config } from 'dotenv';
import { getNetworkByChainId, getNetworkList } from '../config/networks';
function arrayify(data: string): Uint8Array {
  return Uint8Array.from(Buffer.from(data.replace(/^0x/, ''), 'hex'));
}

// const ERC20_ABI = [
//   "function symbol() view returns (string)",
//   "function decimals() view returns (uint8)",
//   "function balanceOf(address) view returns (uint256)",
//   "function approve(address spender, uint256 amount) returns (bool)",
//   "function nonces(address) view returns (uint256)",
//   "function name() view returns (string)",
//   "function allowance(address owner, address spender) view returns (uint256)",
//   "function transfer(address to, uint256 amount) returns (bool)",
//   "function transferFrom(address from, address to, uint256 amount) returns (bool)",
//   "function DOMAIN_SEPARATOR() view returns (bytes32)"
// ];

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


async function generatePermitSignature(
  tokenAddress: string,
  wallet: ethers.Wallet,
  spender: string,
  amount: ethers.BigNumberish,
  deadline: ethers.BigNumberish
) {
  // Attach to token contract (make sure ABI includes permit and nonces)
  const tokenContract = new ethers.Contract(tokenAddress, werc20Abi.abi, wallet);

    // Step 1: Fetch on-chain DOMAIN_SEPARATOR
  const onChainDomainSeparator = await tokenContract.DOMAIN_SEPARATOR();
  console.log("On-chain DOMAIN_SEPARATOR:", onChainDomainSeparator);
  // Fetch token details
  const name = await tokenContract.name();
  const nonce = await tokenContract.nonces(wallet.address);
  const chainId = (await wallet.provider!.getNetwork()).chainId;

  // EIP-712 domain data
  const domain = {
    name,
    version: "2",
    chainId,
    verifyingContract: tokenAddress,
  };

  const offChainDomainSeparator = ethers.TypedDataEncoder.hashDomain(domain);
  console.log("Off-chain DOMAIN_SEPARATOR:", offChainDomainSeparator);

    // Compare domain separators
    if (onChainDomainSeparator !== offChainDomainSeparator) {
      console.error("Domain separator mismatch! Check token name, version, chainId, and verifyingContract.");
    } else {
      console.log("Domain separator matches.");
    }
  

      // Step 3: Fetch current nonce and log
  const nonceBN = await tokenContract.nonces(wallet.address);
  const nonce1 = nonceBN.toString();
  console.log("Current nonce from contract:", nonce1);

  // Permit type data
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  // Permit values
  const value = {
    owner: wallet.address,
    spender,
    value: amount.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };  

  // Sign the typed data
  const signature = await wallet.signTypedData(domain, types, value);

  // Split signature into v, r, s
  const sig = Signature.from(signature);
  const { v, r, s } = sig;

  // Optional sanity check
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
  const nonce = Date.now();

  // const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  // const permit = await generatePermitSignature(tokenAddress, wallet, currentNetwork.bridgeFactoryAddress, amount, deadline);

  const tokenContract = new Contract(tokenAddress, werc20Abi.abi, wallet);
  // const domainSeparator = await tokenContract.DOMAIN_SEPARATOR(); 
  // console.log("Domain Separator:", domainSeparator);

  // await testTokenPermit(tokenContract, wallet, currentNetwork.bridgeFactoryAddress, amount, deadline, permit);

  if (usePermit) {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const permitData = await generatePermitSignature(
      tokenAddress, 
      wallet, 
      currentNetwork.bridgeFactoryAddress, 
      amount, 
      deadline
    );

    return bridgeFactory.lockTokenWithPermit(
      tokenAddress,
      amount,
      targetChainId,
      nonce,
      deadline,
      permitData.v,
      permitData.r,
      permitData.s
    );
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
  const { wallet, currentNetwork } = getProviderAndWallet();
  const bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);

  if (amount <= 0n) throw new Error('Amount must be > 0');

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
  sourceChainId: number,
  signature: string,
  becomeWrapped: boolean
): Promise<ContractTransactionResponse> => {
  console.log("Claiming token");
  console.log("User Address:", userAddress);
  console.log("Token Address:", tokenAddress);
  console.log("Amount:", amount);
  console.log("Nonce:", nonce);
  console.log("Source Chain ID:", sourceChainId);
  console.log("Signature:", signature);

  const targetChainId = cliConfigManager.getCliConfig().targetChainId!;
  const targetNetwork = getNetworkByChainId(targetChainId);
  const provider = new ethers.WebSocketProvider(targetNetwork.wsUrl);
  const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);


  const bridgeFactory = new Contract(targetNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);

  if (becomeWrapped) {
    return bridgeFactory.claimWrappedWithSignature(
      userAddress,
      tokenAddress,
      amount,
      nonce,
      sourceChainId,
      signature
    );
  } else {
    console.log("Claiming original token");
    console.log("User Address:", userAddress);
    console.log("Token Address:", tokenAddress);
    console.log("Amount:", amount);
    console.log("Nonce:", nonce);
    console.log("Source Chain ID:", sourceChainId);
    console.log("Signature:", signature);

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

export async function burnToken(
  wrappedTokenAddress: string,
  originalTokenAddress: string,
  amount: bigint,
  originalChainId: number,
  wallet: ethers.Wallet
): Promise<ethers.TransactionResponse> {
  try {
    const targetNetwork = getNetworkByChainId(cliConfigManager.getCliConfig().targetChainId!);
    const bridgeFactory = new Contract(targetNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, wallet);
    console.log("Bridge Factory: ", targetNetwork.bridgeFactoryAddress);

    console.log('\nReturn Token Transaction Details:');
    console.log('--------------------------------');
    console.log('Network:', targetNetwork.name);
    console.log('Wrapped Token:', wrappedTokenAddress);
    console.log('Original Token:', originalTokenAddress);
    console.log('Amount:', amount.toString());
    console.log('Original Chain ID:', originalChainId.toString());
    console.log('Wallet:', wallet.address);
    console.log('--------------------------------\n');

    // Get the current nonce for the wallet
    if (!wallet.provider) {
      throw new Error('Wallet provider is not initialized');
    }
    const nonce = Date.now();

    console.log("Nonce: ", nonce);
    console.log("Wrapped Token Address: ", wrappedTokenAddress);
    console.log("Original Token Address: ", originalTokenAddress);
    console.log("Amount: ", amount);
    console.log("Original Chain ID: ", originalChainId);
    console.log("Wallet: ", wallet.address);
    console.log("--------------------------------\n");

    const tx = await bridgeFactory.burnWrappedForReturn(
      wrappedTokenAddress,
      originalTokenAddress,
      amount.toString(),
      originalChainId.toString(),
      nonce.toString()
    );

    console.log("Tx: ", tx);

    console.log(`\nTransaction sent! Hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
    
    return tx;
  } catch (error) {
    console.error('Error in returnToken:', error);
    throw error;
  }
}
