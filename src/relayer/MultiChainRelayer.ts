import { Relayer } from './Relayer';
import { getNetworkConfigList } from '../config/networks';

export class MultiChainRelayer {
  private relayers: Relayer[] = [];

  constructor() {
    const networks = getNetworkConfigList();

    this.relayers = networks.map((networkConfig) => new Relayer(networkConfig));

    console.log(`[MultiChainRelayer] Started ${this.relayers.length} relayer instances`);
  }

  stop() {
    for (const relayer of this.relayers) {
      relayer.stop();
    }
  }
}
