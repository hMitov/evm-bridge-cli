import fs from 'fs';
import path from 'path';
import { CLIConfig } from '../types';
import { getNetworkConfigByChainId } from './networks';
import { BASE_SEPOLIA_CHAIN_ID } from './configLoader';
import { ConfigError } from '../errors/ConfigError';
import { error } from 'console';
import { ERROR_MESSAGES } from '../errors/messages/errorMessages';

class CliConfigManager {
  private static CONFIG_FILE = path.resolve(process.cwd(), '.cli-config.json');
  private static ENCODING_FORMAT = 'utf-8';
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

    if (!fs.existsSync(CliConfigManager.CONFIG_FILE)) {
      return { currentNetwork: defaultNetwork };
    }

    try {
      const content = fs.readFileSync(CliConfigManager.CONFIG_FILE, { encoding: CliConfigManager.ENCODING_FORMAT as BufferEncoding });
      const parsed = JSON.parse(content) as Partial<CLIConfig>;

      if (!parsed.currentNetwork?.chainId) {
        throw new ConfigError(ERROR_MESSAGES.INVALID_CONFIG);
      }

      const network = getNetworkConfigByChainId(parsed.currentNetwork.chainId);
      if (!network) {
        throw new ConfigError(ERROR_MESSAGES.UNKNOWN_CHAIN_ID(parsed.currentNetwork.chainId));
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
      fs.writeFileSync(CliConfigManager.CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: CliConfigManager.ENCODING_FORMAT as BufferEncoding });
      this.cliConfig = config;
    } catch (err) {
      throw new ConfigError(error);
    }
  }

  public getCliConfig(): CLIConfig {
    return this.cliConfig;
  }
}

export const cliConfigManager = CliConfigManager.getInstance();
