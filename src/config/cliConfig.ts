import fs from 'fs';
import path from 'path';
import { CLIConfig } from '../types';
import { getNetworkConfigByChainId } from './networks';
import { BASE_SEPOLIA_CHAIN_ID } from './configLoader';

const CONFIG_FILE = path.resolve(process.cwd(), '.cli-config.json');

class CliConfigManager {
  private static instance: CliConfigManager;
  private cliConfig!: CLIConfig;

  private constructor() {
    this.cliConfig = this.loadCliConfig();
  }

  public static getInstance(): CliConfigManager {
    if (!CliConfigManager.instance) {
      CliConfigManager.instance = new CliConfigManager();
    }
    return CliConfigManager.instance;
  }

  private loadCliConfig(): CLIConfig {
    const defaultNetwork = getNetworkConfigByChainId(BASE_SEPOLIA_CHAIN_ID);

    if (!fs.existsSync(CONFIG_FILE)) {
      return { currentNetwork: defaultNetwork };
    }

    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(content) as Partial<CLIConfig>;

      if (!parsed.currentNetwork?.chainId) {
        throw new Error('Invalid config: currentNetwork missing or malformed');
      }

      const network = getNetworkConfigByChainId(parsed.currentNetwork.chainId);
      if (!network) {
        throw new Error(`Unknown network chainId ${parsed.currentNetwork.chainId}`);
      }
      return {
        ...parsed,
        currentNetwork: network,
      } as CLIConfig;
    } catch (err) {
      console.error(`Failed to load CLI config: ${err instanceof Error ? err.message : err}`);
      return { currentNetwork: defaultNetwork };
    }
  }

  public saveCliConfig(config: CLIConfig): void {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8' });
      this.cliConfig = config;
    } catch (err) {
      console.error(`Failed to save CLI config: ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }

  public getCliConfig(): CLIConfig {
    return this.cliConfig;
  }
}

export const cliConfigManager = CliConfigManager.getInstance();
