import { ethers, Contract, Wallet, WebSocketProvider, EventLog } from 'ethers';
import * as bridgeFactoryAbi from '../contracts/abis/BridgeFactory.json';
import { cliConfigManager } from '../config/cliConfig';
import { RELAYER_PRIVATE_KEY } from '../config/config';
import { CLIConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { claimsManager, SignedClaim } from './claimsManager';
import { getNetworkByChainId } from '../config/networks';

export class Relayer {
  private provider!: WebSocketProvider;
  private wallet!: Wallet;
  private bridgeFactory!: Contract;
  private cliConfig!: CLIConfig;
  private listenersActive = false;

  private configPollInterval: NodeJS.Timeout | null = null;
  private logStream: fs.WriteStream;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.cliConfig = cliConfigManager.getCliConfig();
    this.logStream = fs.createWriteStream(path.join(process.cwd(), 'relayer.log'), { flags: 'a' });
    this.initialize();
  }

  private async initialize() {
    this.log('[Relayer] Initializing...');
    await claimsManager.loadFromDisk();
    this.log('[Relayer] Claims loaded from disk');
    await this.connect();
    this.watchConfigChanges();
  }

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    this.logStream.write(logMessage);
    console.log(message);
  }

  // Recursively convert BigInt to string for safe JSON serialization
  private serializeBigInts(obj: any): any {
    if (typeof obj === 'bigint') {
      return obj.toString();
    } else if (Array.isArray(obj)) {
      return obj.map((item) => this.serializeBigInts(item));
    } else if (obj !== null && typeof obj === 'object') {
      const res: any = {};
      for (const key in obj) {
        res[key] = this.serializeBigInts(obj[key]);
      }
      return res;
    }
    return obj;
  }

  private async connect() {
    this.detachListeners();
    const currentNetwork = this.cliConfig.currentNetwork;

    try {
      this.provider = new ethers.WebSocketProvider(currentNetwork.wsUrl);
      this.wallet = new Wallet(RELAYER_PRIVATE_KEY, this.provider);
      this.bridgeFactory = new Contract(currentNetwork.bridgeFactoryAddress, bridgeFactoryAbi.abi, this.wallet);

      // WebSocket reconnection handlers
      const ws = (this.provider as any).websocket;
      if (ws) {
        ws.on('close', () => {
          this.log('[Relayer] WebSocket connection closed. Attempting to reconnect...');
          this.reconnect();
        });

        ws.on('error', (error: Error) => {
          this.log(`[Relayer] WebSocket error: ${error.message}`);
          this.reconnect();
        });
      }

      // Block event logging every 10 blocks
      this.provider.on('block', (blockNumber) => {
        if (blockNumber % 10 === 0) {
          this.log(`[Relayer] Connected at block ${blockNumber}`);
        }
      });

      this.attachListeners();
      this.log(`[Relayer] Connected to network: ${currentNetwork.wsUrl}`);
    } catch (error) {
      this.log(`[Relayer] Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.reconnect();
    }
  }

  private attachListeners() {
    if (!this.bridgeFactory) return;
    this.listenersActive = true;

    this.bridgeFactory.on('TokenLocked', async (...args) => {
      const event = args[args.length - 1] as EventLog;
      this.log(`[Relayer] TokenLocked event detected:\n${JSON.stringify(this.serializeBigInts(event.args), null, 2)}`);

      try {
        const claim = await this.buildAndSignClaim(event);
        claim.claimType = 'lock';
        await claimsManager.addClaim(claim);
        this.log('[Relayer] Claim added to ClaimsManager');
      } catch (error) {
        this.log(`[Relayer] Error processing TokenLocked event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('[Relayer] Full error:', error);
      }
    });

    this.bridgeFactory.on('NativeLocked', async (...args) => {
      const event = args[args.length - 1] as EventLog;
      this.log(`[Relayer] NativeLocked event detected:\n${JSON.stringify(this.serializeBigInts(event.args), null, 2)}`);

      try {
        const claim = await this.buildAndSignClaim(event);
        claim.claimType = 'lock';
        await claimsManager.addClaim(claim);
        this.log('[Relayer] Claim added to ClaimsManager');
      } catch (error) {
        this.log(`[Relayer] Error processing NativeLocked event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('[Relayer] Full error:', error);
      }
    });

    this.bridgeFactory.on('TokenBurned', async (...args) => {
      const event = args[args.length - 1] as EventLog;
      this.log(`[Relayer] TokenBurned event detected:\n${JSON.stringify(this.serializeBigInts(event.args), null, 2)}`);
    
      try {
        const claim = await this.buildAndSignClaim(event);
        claim.claimType = 'burn';
        await claimsManager.addClaim(claim);
        this.log('[Relayer] Claim added to ClaimsManager from TokenBurned');
      } catch (error) {
        this.log(`[Relayer] Error processing TokenBurned event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('[Relayer] Full error:', error);
      }
    });

    this.log('[Relayer] Listeners attached.');
  }

  private detachListeners() {
    if (!this.bridgeFactory || !this.listenersActive) return;
    this.bridgeFactory.removeAllListeners();
    this.provider.removeAllListeners();
    this.listenersActive = false;
    this.log('[Relayer] Listeners detached.');
  }

  /**
   * Signs the claim for TokenLocked or NativeLocked event
   */
  private async buildAndSignClaim(event: EventLog): Promise<SignedClaim> {
    const safeArgs = this.serializeBigInts(event.args);
    this.log('[Relayer] Event args: ' + JSON.stringify(safeArgs));

    const { user, token, amount, targetChainId, nonce } = event.args;
    if (!user || !token || !amount || !targetChainId || !nonce) {
      this.log('[Relayer] ERROR: Missing event argument: ' + JSON.stringify(safeArgs));
      throw new Error('Missing event argument in TokenLocked/NativeLocked event');
    }
    const targetBridgeFactoryAddress = getNetworkByChainId(targetChainId).bridgeFactoryAddress;

    this.log('[Relayer] Signing claim with params: ' + JSON.stringify({
      user,
      token,
      amount: amount.toString(),
      nonce: nonce.toString(),
      sourceChainId: this.cliConfig.currentNetwork.chainId,
      targetBridgeFactoryAddress
    }, null, 2));

    // When hashing, keep BigInts, do NOT convert to strings here!
    const packed = ethers.solidityPacked(
      ['address', 'address', 'uint256', 'uint256', 'uint256', 'address'],
      [
        user,
        token,
        amount,
        nonce,
        this.cliConfig.currentNetwork.chainId,
        targetBridgeFactoryAddress
      ]
    );

    const hash = ethers.keccak256(packed);
    this.log('[Relayer] Hash to sign: ' + hash);

    const signature = await this.wallet.signMessage(ethers.getBytes(hash));
    this.log('[Relayer] Signature: ' + signature);

    return {
      user,
      token,
      amount: amount.toString(),
      sourceChainId: this.cliConfig.currentNetwork.chainId.toString(),
      nonce: nonce.toString(),
      signature,
      claimed: false
    };
  }

  private reconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      this.log('[Relayer] Reconnecting...');
      this.connect();
    }, 5000);
  }

  private watchConfigChanges() {
    this.configPollInterval = setInterval(async () => {
      const newConfig = cliConfigManager.getCliConfig();
      if (
        newConfig.currentNetwork.wsUrl !== this.cliConfig.currentNetwork.wsUrl ||
        newConfig.currentNetwork.bridgeFactoryAddress !== this.cliConfig.currentNetwork.bridgeFactoryAddress
      ) {
        this.log('[Relayer] Network config changed. Switching...');
        await this.connect();
      }
    }, 5000);
  }

  public stop() {
    this.detachListeners();
    if (this.configPollInterval) clearInterval(this.configPollInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.log('[Relayer] Stopped.');
    this.logStream.end();
  }
}

// Entrypoint for running as a script
if (require.main === module) {
  const relayer = new Relayer();
  console.log('[Relayer] Relayer started.');
}
