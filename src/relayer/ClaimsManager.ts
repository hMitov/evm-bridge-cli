import fs from 'fs/promises';
import path from 'path';
import { ethers } from 'ethers';
import { BridgeUtils } from '../utils/BridgeUtils';
import { ClaimType, SignedClaim } from '../types';

export class ClaimsManager {
  private static CLAIMS_FILE_NAME = 'claims.json';
  private static ENCODING_FORMAT = 'utf-8';
  private static ENOENT_ERROR_CODE = 'ENOENT';
  private static OBJECT_TYPE = 'object';
  private claims: Map<string, SignedClaim[]> = new Map();
  private filePath: string;
  private loaded: boolean = false;
  private saving: boolean = false;

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), ClaimsManager.CLAIMS_FILE_NAME);
  }

  async loadFromFile(): Promise<void> {
    if (this.loaded) return;

    try {
      const content = await fs.readFile(this.filePath, { encoding: ClaimsManager.ENCODING_FORMAT as BufferEncoding });
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
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
      } else if (typeof parsed === ClaimsManager.OBJECT_TYPE && parsed !== null) {
        const claim = parsed as any;
        const user = claim.user || '';
        if (user) {
          this.claims = new Map([[user, [claim]]]);
        } else {
          this.claims = new Map();
        }
      } else {
        this.claims = new Map();
      }

      this.loaded = true;
      console.log('Loaded claims from file.');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === ClaimsManager.ENOENT_ERROR_CODE) {
        console.log('Claims log file not found, starting fresh.');
      } else {
        console.error('Error reading claims log:', err);
      }
      this.claims = new Map();
      this.loaded = true;
    }
  }

  async saveToFile(): Promise<void> {
    if (this.saving) {
      console.warn('Save already in progress, skipping duplicate call.');
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
      console.log('Claims saved to disk.');
    } catch (err) {
      console.error('Failed to save claims:', err);
      throw err;
    } finally {
      this.saving = false;
    }
  }
  async addClaim(claim: SignedClaim): Promise<void> {
    await this.loadFromFile();
    let normalizedUser: string;
    let normalizedToken: string;

    try {
      normalizedUser = BridgeUtils.normalizeAddress(claim.user);
      normalizedToken = BridgeUtils.normalizeAddress(claim.token);
    } catch (err) {
      console.error(`Invalid address in claim: ${err instanceof Error ? err.message : err}`);
      throw err;
    }

    const normalizedClaim = {
      ...claim,
      user: normalizedUser,
      token: normalizedToken,
    };

    const userClaims = this.claims.get(normalizedUser) || [];
    userClaims.push(normalizedClaim);
    this.claims.set(normalizedUser, userClaims);

    await this.saveToFile();
    console.log(`Added claim nonce ${claim.nonce} for user ${normalizedUser}`);
  }

  async getNextUnclaimedClaim(user: string, claimType?: ClaimType.LOCK | ClaimType.BURN): Promise<SignedClaim | null> {
    await this.loadFromFile();

    let normalizedUser: string;
    try {
      normalizedUser = BridgeUtils.normalizeAddress(user);
    } catch (err) {
      console.error(`Invalid user address: ${err instanceof Error ? err.message : err}`);
      return null;
    }

    const userClaims = this.claims.get(normalizedUser) || [];
    const filtered = claimType
      ? userClaims.filter(c => !c.claimed && c.claimType === claimType)
      : userClaims.filter(c => !c.claimed);
    return filtered.length > 0 ? filtered[0] : null;
  }

  async getNextClaimedClaim(user: string, claimType?: ClaimType.LOCK | ClaimType.BURN): Promise<SignedClaim | null> {
    await this.loadFromFile();

    let normalizedUser: string;
    try {
      normalizedUser = BridgeUtils.normalizeAddress(user);
    } catch (err) {
      console.error(`Invalid user address: ${err instanceof Error ? err.message : err}`);
      return null;
    }

    const userClaims = this.claims.get(normalizedUser) || [];
    const filtered = claimType
      ? userClaims.filter(c => c.claimed && c.claimType === claimType)
      : userClaims.filter(c => c.claimed);
    return filtered.length > 0 ? filtered[0] : null;
  }

  async markClaimAsClaimed(user: string, nonce: string, claimChainId: string): Promise<void> {
    await this.loadFromFile();

    let normalizedUser: string;
    try {
      normalizedUser = BridgeUtils.normalizeAddress(user);
    } catch (err) {
      console.error(`Invalid user address: ${err instanceof Error ? err.message : err}`);
      return;
    }

    const userClaims = this.claims.get(normalizedUser);
    if (!userClaims) {
      console.warn(`No claims found for user ${normalizedUser}.`);
      return;
    }
    const claim = userClaims.find(c => c.nonce === nonce && c.claimChainId === claimChainId);
    if (!claim) {
      console.warn(`Claim nonce ${nonce} not found for user ${normalizedUser}.`);
      return;
    }
    if (claim.claimed) {
      console.log(`Claim nonce ${nonce} already marked claimed.`);
      return;
    }
    claim.claimed = true;
    await this.saveToFile();
    console.log(`Claim nonce ${nonce} marked as claimed for user ${normalizedUser}.`);
  }

}

export const claimsManager = new ClaimsManager();
