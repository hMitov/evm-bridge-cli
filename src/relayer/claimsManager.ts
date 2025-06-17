import fs from 'fs/promises';
import path from 'path';
import { ethers } from 'ethers';

export interface SignedClaim {
  user: string;
  token: string;
  amount: string;       // store as string to avoid BigInt serialization issues
  sourceChainId: string;
  nonce: string;
  signature: string;
  claimed?: boolean;
  claimType?: 'lock' | 'burn'; // Optional claim type
}


export class ClaimsManager {
  private claims: Map<string, SignedClaim[]> = new Map();
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'claims.json');
    console.log(`[ClaimsManager] Initialized with file: ${this.filePath}`);
  }

  private normalizeAddress(address: string): string {
    return address.toLowerCase();
  }

  async loadFromDisk(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const parsed: [string, SignedClaim[]][] = JSON.parse(content);
      this.claims = new Map(
        parsed.map(([user, claims]) => [
          user,
          claims.map(claim => ({
            ...claim,
            user: claim.user,
            token: claim.token,
          })),
        ])
      );
      console.log('[ClaimsManager] Loaded claims from disk.');
    } catch (error) {
      console.log('[ClaimsManager] No claims file found or error reading file, starting fresh.');
      this.claims = new Map();
    }
  }

  async saveToDisk(): Promise<void> {
    const data = JSON.stringify(
      Array.from(this.claims.entries()).map(([user, claims]) => [
        ethers.getAddress(user),
        claims.map(claim => ({
          ...claim,
          user: ethers.getAddress(claim.user),
          token: ethers.getAddress(claim.token)
        }))
      ]),
      null,
      2
    );
    await fs.writeFile(this.filePath, data);
    console.log('[ClaimsManager] Claims saved to disk.');
  }

  async addClaim(claim: SignedClaim): Promise<void> {
    const checksummedUser = ethers.getAddress(claim.user);
    const userClaims = this.claims.get(checksummedUser) || [];
    userClaims.push(claim);
    this.claims.set(checksummedUser, userClaims);
    await this.saveToDisk();
  }

  async getNextUnclaimedClaim(user: string, claimType?: 'lock' | 'burn'): Promise<SignedClaim | null> {
    await this.loadFromDisk();
    const checksummedUser = ethers.getAddress(user);
    const userClaims = this.claims.get(checksummedUser) || [];
    const filteredClaims = claimType
      ? userClaims.filter(c => !c.claimed && c.claimType === claimType)
      : userClaims.filter(c => !c.claimed);
    return filteredClaims[0] || null;
  }

  async markClaimAsClaimed(user: string, nonce: string): Promise<void> {
    const checksummedUser = ethers.getAddress(user);
    const userClaims = this.claims.get(checksummedUser) || [];
    const claim = userClaims.find(c => c.nonce === nonce);
    if (claim) {
      claim.claimed = true;
      await this.saveToDisk();
      console.log(`[ClaimsManager] Claim nonce ${nonce} marked as claimed for user ${user}.`);
    } else {
      console.log(`[ClaimsManager] Claim nonce ${nonce} not found for user ${user}.`);
    }
  }
}

export const claimsManager = new ClaimsManager();
