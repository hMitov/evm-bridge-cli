import { ethers, Contract, Wallet, WebSocketProvider, EventLog } from 'ethers';
import * as bridgeFactoryAbi from '../contracts/abis/BridgeFactory.json';
import { RELAYER_PRIVATE_KEY } from '../config/configLoader';
import { NetworkConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { claimsManager, SignedClaim } from './claimsManager';
import { getNetworkConfigByChainId } from '../config/networks';

export class Relayer {
  private provider!: WebSocketProvider;
  private wallet!: Wallet;
  private bridgeFactory!: Contract;
  private networkConfig!: NetworkConfig;
  private listenersActive = false;

  private configPollInterval: NodeJS.Timeout | null = null;
  private logStream: fs.WriteStream;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(networkConfig: NetworkConfig) {
    this.networkConfig = networkConfig;
    this.logStream = fs.createWriteStream(
      path.join(process.cwd(), `relayer-${networkConfig.chainId}.log`),
      { flags: 'a' }
    );
    this.initialize().catch((err) => {
      this.log(`[Relayer] Initialization error: ${err instanceof Error ? err.message : err}`);
      console.error(err);
    });
  }

  private async initialize() {
    this.log('[Relayer] Initializing...');
    await claimsManager.loadFromFile();
    this.log('[Relayer] Claims loaded from disk');
    await this.connect();
  }

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    this.logStream.write(logMessage);
    console.log(message);
  }

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
    this.log(`[Relayer] Connecting to network: ${this.networkConfig.name} (${this.networkConfig.chainId})`);

    try {
      this.provider = new ethers.WebSocketProvider(this.networkConfig.wsUrl);
      this.wallet = new Wallet(RELAYER_PRIVATE_KEY, this.provider);
      this.bridgeFactory = new Contract(this.networkConfig.bridgeFactoryAddress, bridgeFactoryAbi.abi, this.wallet);

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

      this.attachListeners();
      this.log(`[Relayer] Connected to network: ${this.networkConfig.wsUrl}`);
    } catch (error) {
      this.log(`[Relayer] Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.reconnect();
    }
  }

  private attachListeners() {
    if (!this.bridgeFactory) return;
    if (this.listenersActive) return;
    this.listenersActive = true;

    this.bridgeFactory.on('TokenLocked', async (...args) => {
      const event = args[args.length - 1] as EventLog;
      this.log(`[Relayer] TokenLocked event detected:\n${JSON.stringify(this.serializeBigInts(event.args), null, 2)}`);

      try {
        const claim = await this.buildAndSignClaim(event, 'lock');
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
        const claim = await this.buildAndSignClaim(event, 'lock');
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
        const claim = await this.buildAndSignClaim(event, 'burn');
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

  private async buildAndSignClaim(event: EventLog, claimType: 'lock' | 'burn'): Promise<SignedClaim> {
    const safeArgs = this.serializeBigInts(event.args);
    this.log('[Relayer] Event args: ' + JSON.stringify(safeArgs));

    let user, token, amount, targetChainId, sourceChainId, nonce, originalToken, originalChainId;
    let targetBridgeFactoryAddress: string | null = null;
    let packed: string | null = null;

    if (claimType === 'lock') {
      if (event.eventName === 'TokenLocked') {
        ({ user, token, amount, targetChainId, nonce } = event.args);
      } else if (event.eventName === 'NativeLocked') {
        [user, amount, targetChainId, nonce] = event.args;
        token = ethers.ZeroAddress;
      } else {
        throw new Error(`Unsupported event type for lock claim: ${event.eventName}`);
      }

      if (!user || !token || !amount || !targetChainId || !nonce) {
        this.log('[Relayer] ERROR: Missing event argument: ' + JSON.stringify(safeArgs));
        throw new Error('Missing event argument in event');
      }

      targetBridgeFactoryAddress = getNetworkConfigByChainId(targetChainId).bridgeFactoryAddress;
      packed = ethers.solidityPacked(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'address'],
        [user, token, amount, nonce, this.networkConfig.chainId, targetBridgeFactoryAddress]
      );

      const hash = ethers.keccak256(packed!);

      const signature = await this.wallet.signMessage(ethers.getBytes(hash));
      this.log('[Relayer] Signature: ' + signature);

      return {
        user,
        token,
        amount: amount.toString(),
        nonce: nonce.toString(),
        sourceChainId: this.networkConfig.chainId.toString(),
        signature,
        claimed: false
      };

    } else if (claimType === 'burn') {
      if (event.eventName !== 'TokenBurned') {
        throw new Error(`Unsupported event type: ${event.eventName}`);
      }
      
      let [user, token, originalToken, amount, originalChainId, nonce] = event.args;

      if (!user || !token || !originalToken || !amount || !originalChainId || !nonce) {
        this.log('[Relayer] ERROR: Missing event argument: ' + JSON.stringify(safeArgs));
        throw new Error('Missing event argument in event');
      }

      targetBridgeFactoryAddress = getNetworkConfigByChainId(originalChainId).bridgeFactoryAddress;

      token = originalToken;

      packed = ethers.solidityPacked(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'address'],
        [user, token, amount, nonce, originalChainId, targetBridgeFactoryAddress]
      );

      const hash = ethers.keccak256(packed!);

      const signature = await this.wallet.signMessage(ethers.getBytes(hash));
      this.log('[Relayer] Signature: ' + signature);

      return {
        user,
        token,
        amount: amount.toString(),
        nonce: nonce.toString(),
        sourceChainId: this.networkConfig.chainId.toString(),
        signature,
        claimed: false
      };
    }

    throw new Error('Invalid claim type');
  }

  private reconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.log('[Relayer] Reconnecting...');
      this.connect().catch(err => {
        this.log(`[Relayer] Reconnect failed: ${err instanceof Error ? err.message : err}`);
      });
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
