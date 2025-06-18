import { Relayer } from './Relayer';
import { cliConfigManager } from '../config/cliConfig';
import { getNetworkList } from '../config/networks';

export class MultiChainRelayer {
  private relayers: Relayer[] = [];

  constructor() {
    // Suppose your cliConfigManager supports loading configs for multiple chains:
    const networks = getNetworkList(); // implement this method to return array

    for (const newtworkConfig of networks) {
      const relayer = new Relayer(newtworkConfig);
      this.relayers.push(relayer);
      // Note: Relayer initializes itself and starts listening on construction
    }

    console.log(`[MultiChainRelayer] Started ${this.relayers.length} relayer instances`);
  }

  stop() {
    for (const relayer of this.relayers) {
      relayer.stop();
    }
  }
}
