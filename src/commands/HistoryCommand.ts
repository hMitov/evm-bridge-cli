import { HistoryError } from '../errors/HistoryError';
import { TxLogger } from '../utils/TxLogger';

export class HistoryCommand {
  
  public async execute(): Promise<void> {
    try {
      TxLogger.showAllTransactions();
    } catch (error) {
      console.error('Failed to display transaction history:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw new HistoryError(error);
    }
  }
}
