import { TxLogger } from '../utils/txLogger';

export class HistoryCommand {
  public async execute(): Promise<void> {
    TxLogger.showAllTransactions();
  }
} 