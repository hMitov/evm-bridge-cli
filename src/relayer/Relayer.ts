import { ethers, Contract, Wallet, WebSocketProvider, EventLog } from 'ethers';
import * as bridgeFactoryAbi from '../contracts/abis/BridgeFactory.json';
import { RELAYER_PRIVATE_KEY } from '../config/configLoader';
import { ClaimType, EventName, NetworkConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { claimsManager } from './ClaimsManager';
import { getNetworkConfigByChainId } from '../config/networks';
import { SignedClaim } from '../types';
import { cliConfigManager } from '../config/cliConfig';

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
    if (!this.bridgeFactory || this.listenersActive) return;
    this.listenersActive = true;

    this.bridgeFactory.on(EventName.TOKEN_LOCKED, async (...args) => {
      await this.handleEvent(EventName.TOKEN_LOCKED, args);
    });

    this.bridgeFactory.on(EventName.NATIVE_LOCKED, async (...args) => {
      await this.handleEvent(EventName.NATIVE_LOCKED, args);
    });

    this.bridgeFactory.on(EventName.TOKEN_BURNED, async (...args) => {
      await this.handleEvent(EventName.TOKEN_BURNED, args);
    });

    this.log('Listeners attached.');
  }

  private async handleEvent(eventName: string, args: any[]) {
    const event = args[args.length - 1] as EventLog;
    this.log(`${eventName} event detected:\n${JSON.stringify(this.serializeBigInts(event.args), null, 2)}`);

    try {
      const claimType = eventName === EventName.TOKEN_BURNED ? ClaimType.BURN : ClaimType.LOCK;
      const claim = await this.buildAndSignClaim(event, claimType);
      claim.claimType = claimType;
      await claimsManager.addClaim(claim);
      this.log(`Claim added to ClaimsManager from ${eventName}`);
    } catch (error) {
      this.log(`Error processing ${eventName} event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`[Relayer] Full error:`, error);
    }
  }

  private detachListeners() {
    if (!this.bridgeFactory || !this.listenersActive) return;
    this.bridgeFactory.removeAllListeners();
    this.provider.removeAllListeners();
    this.listenersActive = false;
    this.log('[Relayer] Listeners detached.');
  }

  private async buildAndSignClaim(event: EventLog, claimType: ClaimType.LOCK | ClaimType.BURN): Promise<SignedClaim> {
    const safeArgs = this.serializeBigInts(event.args);
    this.log('[Relayer] Event args: ' + JSON.stringify(safeArgs));

    let user, token, amount, targetChainId, sourceChainId, nonce, originalToken, originalChainId;
    let targetBridgeFactoryAddress: string | null = null;
    let packed: string | null = null;

    if (claimType === ClaimType.LOCK) {
      if (event.eventName === EventName.TOKEN_LOCKED) {
        ({ user, token, amount, targetChainId, nonce } = event.args);
      } else if (event.eventName === EventName.NATIVE_LOCKED) {
        [user, amount, targetChainId, nonce] = event.args;
        token = ethers.ZeroAddress;
      } else {
        throw new Error(`Unsupported event type for lock claim: ${event.eventName}`);
      }

      if (!user || !token || !amount || !targetChainId) {
        this.log('[Relayer] ERROR: Missing event argument: ' + JSON.stringify(safeArgs));
        throw new Error('Missing event argument in event');
      }

      targetBridgeFactoryAddress = getNetworkConfigByChainId(targetChainId).bridgeFactoryAddress;
      const deadline = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;

      packed = ethers.solidityPacked(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
        [user, token, amount, nonce, this.networkConfig.chainId, Number(targetChainId), targetBridgeFactoryAddress, deadline]
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
        claimChainId: targetChainId.toString(),
        signature,
        deadline: deadline.toString(),
        claimed: false
      };
    } else if (claimType === ClaimType.BURN) {
      if (event.eventName !== EventName.TOKEN_BURNED) {
        throw new Error(`Unsupported event type: ${event.eventName}`);
      }
      
      let [user, token, originalToken, amount, originalChainId, nonce] = event.args;

      if (!user || !token || !originalToken || !amount || !originalChainId) {
        this.log('[Relayer] ERROR: Missing event argument: ' + JSON.stringify(safeArgs));
        throw new Error('Missing event argument in event');
      }

      targetBridgeFactoryAddress = getNetworkConfigByChainId(originalChainId).bridgeFactoryAddress;
      const deadline = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;
      token = originalToken;

      const cliConfig = cliConfigManager.getCliConfig();

      packed = ethers.solidityPacked(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
        [user, token, amount, nonce, cliConfig.targetChainId, originalChainId, targetBridgeFactoryAddress, deadline]
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
        claimChainId: originalChainId.toString(),
        signature,
        deadline: deadline.toString(),
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
