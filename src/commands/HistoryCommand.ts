import { ethers, EventLog } from 'ethers';
import * as bridgeFactoryAbi from '../contracts/abis/BridgeFactory.json';
import { cliConfigManager } from '../config/cliConfig';

interface TokenLockedEvent {
  token: string;
  sender: string;
  amount: bigint;
  targetChainId: bigint;
}

interface TokenClaimedEvent {
  token: string;
  recipient: string;
  amount: bigint;
  sourceChainId: bigint;
}

interface TokenReturnedEvent {
  token: string;
  sender: string;
  amount: bigint;
  sourceChainId: bigint;
}

interface BridgeTransaction {
  type: 'lock' | 'claim' | 'return';
  token: string;
  amount: string;
  sourceChainId?: number;
  targetChainId?: number;
  timestamp: number;
  txHash: string;
}

export class HistoryCommand {
  public async execute(): Promise<void> {
    try {
      const currentNetwork = cliConfigManager.getCliConfig().currentNetwork;
      const provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
      const bridgeFactory = new ethers.Contract(
        currentNetwork.bridgeFactoryAddress,
        bridgeFactoryAbi.abi,
        provider
      );

      // Query events from the last 10,000 blocks
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);

      const [lockEvents, claimEvents, returnEvents] = await Promise.all([
        bridgeFactory.queryFilter(bridgeFactory.filters.TokenLocked(), fromBlock),
        bridgeFactory.queryFilter(bridgeFactory.filters.TokenClaimed(), fromBlock),
        bridgeFactory.queryFilter(bridgeFactory.filters.TokenReturned(), fromBlock)
      ]);

      const transactions: BridgeTransaction[] = [
        ...lockEvents.map((event) => {
          if (!(event instanceof EventLog)) {
            throw new Error('Expected EventLog for TokenLocked event');
          }
          const args = event.args as unknown as TokenLockedEvent;
          return {
            type: 'lock' as const,
            token: args.token,
            amount: ethers.formatUnits(args.amount, 18), // Assuming 18 decimals
            targetChainId: Number(args.targetChainId),
            timestamp: event.blockNumber,
            txHash: event.transactionHash
          };
        }),
        ...claimEvents.map((event) => {
          if (!(event instanceof EventLog)) {
            throw new Error('Expected EventLog for TokenClaimed event');
          }
          const args = event.args as unknown as TokenClaimedEvent;
          return {
            type: 'claim' as const,
            token: args.token,
            amount: ethers.formatUnits(args.amount, 18), // Assuming 18 decimals
            sourceChainId: Number(args.sourceChainId),
            timestamp: event.blockNumber,
            txHash: event.transactionHash
          };
        }),
        ...returnEvents.map((event) => {
          if (!(event instanceof EventLog)) {
            throw new Error('Expected EventLog for TokenReturned event');
          }
          const args = event.args as unknown as TokenReturnedEvent;
          return {
            type: 'return' as const,
            token: args.token,
            amount: ethers.formatUnits(args.amount, 18), // Assuming 18 decimals
            sourceChainId: Number(args.sourceChainId),
            timestamp: event.blockNumber,
            txHash: event.transactionHash
          };
        })
      ];

      // Sort by timestamp (block number)
      transactions.sort((a, b) => b.timestamp - a.timestamp);

      // Display transactions
      console.log('\nBridge Transaction History:');
      console.log('---------------------------');
      
      for (const tx of transactions) {
        const date = new Date(tx.timestamp * 1000).toLocaleString();
        console.log(`\nType: ${tx.type.toUpperCase()}`);
        console.log(`Token: ${tx.token}`);
        console.log(`Amount: ${tx.amount}`);
        if (tx.sourceChainId) {
          console.log(`Source Chain ID: ${tx.sourceChainId}`);
        }
        if (tx.targetChainId) {
          console.log(`Target Chain ID: ${tx.targetChainId}`);
        }
        console.log(`Date: ${date}`);
        console.log(`Transaction: ${tx.txHash}`);
        console.log('---------------------------');
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error occurred');
      process.exit(1);
    }
  }
} 