import fs from 'fs';
import path from 'path';
import { CLIConfig } from '../types';
import { getNetworkByChainId } from './networks';

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
    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultNetwork = getNetworkByChainId(11155111);
      return {
        currentNetwork: defaultNetwork,
      };
    }

    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(content) as CLIConfig;

      if (!parsed.currentNetwork || !parsed.currentNetwork.chainId) {
        throw new Error('Invalid config: currentNetwork missing or malformed');
      }

      const network = getNetworkByChainId(parsed.currentNetwork.chainId);
      return {
        ...parsed,
        currentNetwork: network,
      };
    } catch {
      const defaultNetwork = getNetworkByChainId(11155111);
      return {
        currentNetwork: defaultNetwork,
      };
    }
  }

  public saveCliConfig(config: CLIConfig): void {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    this.cliConfig = config;
  }

  public getCliConfig(): CLIConfig {
    return this.cliConfig;
  }
}

export const cliConfigManager = CliConfigManager.getInstance();
