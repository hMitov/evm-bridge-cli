export abstract class BaseCommand {

  public async execute() {
    try {
      await this.action();
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  protected abstract action(): Promise<void>;
}
