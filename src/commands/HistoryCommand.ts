import { TxLogger } from '../utils/txLogger';

export class HistoryCommand {
  public async execute(): Promise<void> {
    try {
      TxLogger.showAllTransactions();
    } catch (error) {
      console.error(
        'Failed to display transaction history:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }
}
