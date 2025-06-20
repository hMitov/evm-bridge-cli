import fs from 'fs/promises';
import path from 'path';
import { ethers } from 'ethers';

export interface SignedClaim {
  user: string;
  token: string;
  amount: string;
  sourceChainId: string;
  nonce: string;
  signature: string;
  claimed?: boolean;
  claimType?: 'lock' | 'burn';
}

export class ClaimsManager {
  private claims: Map<string, SignedClaim[]> = new Map();
  private filePath: string;
  private loaded: boolean = false;
  private saving: boolean = false;

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'claims.json');
    console.log(`[ClaimsManager] Initialized with file: ${this.filePath}`);
  }

  private normalizeAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }
  }
  
  async loadFromFile(): Promise<void> {
    if (this.loaded) return;

    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content);

      // Handle different formats
      if (Array.isArray(parsed)) {
        // Array format: [[user, claims[]], ...]
        this.claims = new Map(
          parsed.map(([user, claims]: [string, any[]]) => [
            user,
            claims.map((claim: any) => ({
              ...claim,
              user: claim.user,
              token: claim.token,
            })),
          ])
        );
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Single object format - convert to proper format
        const claim = parsed as any;
        const user = claim.user || '';
        if (user) {
          this.claims = new Map([[user, [claim]]]);
        } else {
          this.claims = new Map();
        }
      } else {
        // Fallback to empty map
        this.claims = new Map();
      }

      this.loaded = true;
      console.log('[ClaimsManager] Loaded claims from file.');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('[ClaimsManager] Claims log file not found, starting fresh.');
      } else {
        console.error('[ClaimsManager] Error reading claims log:', err);
      }
      this.claims = new Map();
      this.loaded = true;
    }
  }

  async saveToFile(): Promise<void> {
    if (this.saving) {
      console.warn('[ClaimsManager] Save already in progress, skipping duplicate call.');
      return;
    }
    this.saving = true;
    try {
      const data = JSON.stringify(
        Array.from(this.claims.entries()).map(([user, claims]) => [
          ethers.getAddress(user),
          claims.map(claim => ({
            ...claim,
            user: ethers.getAddress(claim.user),
            token: ethers.getAddress(claim.token)
          })),
        ]),
        null,
        2
      );

      await fs.writeFile(this.filePath, data);
      console.log('[ClaimsManager] Claims saved to disk.');
    } catch (err) {
      console.error('[ClaimsManager] Failed to save claims:', err);
      throw err;
    } finally {
      this.saving = false;
    }
  }
  async addClaim(claim: SignedClaim): Promise<void> {
    await this.loadFromFile();

    const normalizedUser = this.normalizeAddress(claim.user);
    const normalizedClaim = {
      ...claim,
      user: normalizedUser,
      token: this.normalizeAddress(claim.token),
    };

    const userClaims = this.claims.get(normalizedUser) || [];
    userClaims.push(normalizedClaim);
    this.claims.set(normalizedUser, userClaims);

    await this.saveToFile();
    console.log(`[ClaimsManager] Added claim nonce ${claim.nonce} for user ${normalizedUser}`);
  }

  async getNextUnclaimedClaim(user: string, claimType?: 'lock' | 'burn'): Promise<SignedClaim | null> {
    await this.loadFromFile();
    const normalizedUser = this.normalizeAddress(user);
    const userClaims = this.claims.get(normalizedUser) || [];
    const filtered = claimType
      ? userClaims.filter(c => !c.claimed && c.claimType === claimType)
      : userClaims.filter(c => !c.claimed);
    return filtered.length > 0 ? filtered[0] : null;
  }

  async getNextClaimedClaim(user: string, claimType?: 'lock' | 'burn'): Promise<SignedClaim | null> {
    await this.loadFromFile();
    const normalizedUser = this.normalizeAddress(user);
    const userClaims = this.claims.get(normalizedUser) || [];
    const filtered = claimType
      ? userClaims.filter(c => c.claimed && c.claimType === claimType)
      : userClaims.filter(c => c.claimed);
    return filtered.length > 0 ? filtered[0] : null;
  }

  async markClaimAsClaimed(user: string, nonce: string): Promise<void> {
    await this.loadFromFile();
    const normalizedUser = this.normalizeAddress(user);
    const userClaims = this.claims.get(normalizedUser);
    if (!userClaims) {
      console.warn(`[ClaimsManager] No claims found for user ${normalizedUser}`);
      return;
    }
    const claim = userClaims.find(c => c.nonce === nonce);
    if (!claim) {
      console.warn(`[ClaimsManager] Claim nonce ${nonce} not found for user ${normalizedUser}`);
      return;
    }
    if (claim.claimed) {
      console.log(`[ClaimsManager] Claim nonce ${nonce} already marked claimed.`);
      return;
    }
    claim.claimed = true;
    await this.saveToFile();
    console.log(`[ClaimsManager] Claim nonce ${nonce} marked as claimed for user ${normalizedUser}.`);
  }

}

export const claimsManager = new ClaimsManager();
