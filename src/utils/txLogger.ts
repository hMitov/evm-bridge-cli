import * as fs from 'fs';
import * as path from 'path';

export class TxLogger {
  static logTransaction(data: any) {
    const serializeBigInts = (obj: any): any => {
      if (typeof obj === 'bigint') return obj.toString();
      if (Array.isArray(obj)) return obj.map(serializeBigInts);
      if (obj && typeof obj === 'object') {
        const res: any = {};
        for (const k in obj) res[k] = serializeBigInts(obj[k]);
        return res;
      }
      return obj;
    };
    const txData = {
      ...serializeBigInts(data),
      timestamp: new Date().toISOString(),
    };
    const logPath = path.join(process.cwd(), 'transactions.log');
    fs.appendFileSync(logPath, JSON.stringify(txData) + '\n', 'utf8');
  }

  static showAllTransactions() {
    const logPath = path.join(process.cwd(), 'transactions.log');
    if (!fs.existsSync(logPath)) {
      console.log('No transactions found.');
      return;
    }
    const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
    const transactions = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    console.log('\nAll Bridge Transactions:');
    console.log('------------------------');
    for (const tx of transactions) {
      console.log(`\nCommand: ${tx.command?.toUpperCase()}`);
      console.log(`Hash: ${tx.hash}`);
      console.log(`Block: ${tx.blockNumber}`);
      console.log(`From: ${tx.from}`);
      console.log(`To: ${tx.to}`);
      console.log(`Amount: ${tx.amount}`);
      if (tx.tokenAddress) console.log(`Token: ${tx.tokenAddress}`);
      if (tx.wrappedTokenAddress) console.log(`Wrapped Token: ${tx.wrappedTokenAddress}`);
      if (tx.originalTokenAddress) console.log(`Original Token: ${tx.originalTokenAddress}`);
      if (tx.user) console.log(`User: ${tx.user}`);
      if (tx.token) console.log(`Token: ${tx.token}`);
      if (tx.chainId) console.log(`Chain ID: ${tx.chainId}`);
      if (tx.gasUsed) console.log(`Gas Used: ${tx.gasUsed}`);
      console.log(`Timestamp: ${tx.timestamp}`);
      console.log('------------------------');
    }
  }
} 