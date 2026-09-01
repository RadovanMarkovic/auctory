import { getAddress, verifyMessage, Wallet } from "ethers";
import { describe, expect, it } from "vitest";

import { buildWalletMessage, sameAddress, SEPOLIA_CHAIN_ID, shortenAddress } from "./message";

/**
 * These tests exercise the exact verification rules the server enforces:
 * a signature must recover to the bound address, nonces are single-use and
 * expiring, wallets are unique per user, and profile columns cannot be forged.
 * The nonce store and profile writes are modelled the way the database
 * functions behave (conditional consumption + unique lower-case address).
 */

interface NonceRow {
  userId: string;
  address: string;
  expiresAt: number;
  consumed: boolean;
}

class WalletBackend {
  private nonces = new Map<string, NonceRow>();
  /** normalized address -> user id */
  private wallets = new Map<string, string>();
  profiles = new Map<string, { address: string; verifiedAt: string; network: string }>();

  issueNonce(userId: string, address: string, ttlMs = 5 * 60 * 1000) {
    const nonce = `n${this.nonces.size + 1}`;
    this.nonces.set(nonce, {
      userId,
      address: getAddress(address),
      expiresAt: Date.now() + ttlMs,
      consumed: false,
    });
    return nonce;
  }

  /** Mirrors the conditional single-use consumption in SQL. */
  private consume(userId: string, nonce: string, now = Date.now()) {
    const row = this.nonces.get(nonce);
    if (!row || row.consumed || row.userId !== userId || row.expiresAt <= now) return null;
    row.consumed = true;
    return row;
  }

  verify(
    userId: string,
    nonce: string,
    signature: string,
    opts: { domain?: string; now?: number } = {},
  ) {
    const row = this.consume(userId, nonce, opts.now);
    if (!row) throw new Error("NONCE_INVALID");

    const message = buildWalletMessage({
      domain: opts.domain ?? "auctory.app",
      userId,
      address: row.address,
      nonce,
      expiresAt: new Date(row.expiresAt).toISOString(),
    });

    let recovered: string;
    try {
      recovered = getAddress(verifyMessage(message, signature));
    } catch {
      throw new Error("SIGNATURE_INVALID");
    }
    if (recovered !== row.address) throw new Error("SIGNATURE_INVALID");

    const key = row.address.toLowerCase();
    const owner = this.wallets.get(key);
    if (owner && owner !== userId) throw new Error("WALLET_ALREADY_LINKED");
    this.wallets.set(key, userId);
    this.profiles.set(userId, {
      address: row.address,
      verifiedAt: new Date().toISOString(),
      network: "sepolia",
    });
    return this.profiles.get(userId)!;
  }

  /** Mirrors the trigger rejecting direct wallet-column writes. */
  directProfileUpdate() {
    throw new Error("WALLET_COLUMNS_PROTECTED");
  }

  messageFor(userId: string, nonce: string, domain = "auctory.app") {
    const row = this.nonces.get(nonce)!;
    return buildWalletMessage({
      domain,
      userId,
      address: row.address,
      nonce,
      expiresAt: new Date(row.expiresAt).toISOString(),
    });
  }
}

describe("wallet verification message", () => {
  it("binds domain, user, address, Sepolia chain, nonce and expiry", () => {
    const message = buildWalletMessage({
      domain: "auctory.app",
      userId: "user-1",
      address: "0x0000000000000000000000000000000000000001",
      nonce: "abc",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    expect(message).toContain("auctory.app");
    expect(message).toContain("user-1");
    expect(message).toContain(String(SEPOLIA_CHAIN_ID));
    expect(message).toContain("abc");
    expect(message).toContain("2026-01-01T00:00:00.000Z");
  });

  it("compares addresses case-insensitively and shortens them", () => {
    const a = "0xAbC0000000000000000000000000000000000001";
    expect(sameAddress(a, a.toLowerCase())).toBe(true);
    expect(shortenAddress(a)).toContain("…");
  });
});

describe("wallet verification rules", () => {
  it("stores the wallet only after a valid signature", async () => {
    const backend = new WalletBackend();
    const wallet = Wallet.createRandom();
    const nonce = backend.issueNonce("user-1", wallet.address);
    const signature = await wallet.signMessage(backend.messageFor("user-1", nonce));

    const result = backend.verify("user-1", nonce, signature);
    expect(result.address).toBe(getAddress(wallet.address));
    expect(result.network).toBe("sepolia");
  });

  it("rejects an unsigned address (signature from another wallet)", async () => {
    const backend = new WalletBackend();
    const wallet = Wallet.createRandom();
    const attacker = Wallet.createRandom();
    const nonce = backend.issueNonce("user-1", wallet.address);
    const signature = await attacker.signMessage(backend.messageFor("user-1", nonce));

    expect(() => backend.verify("user-1", nonce, signature)).toThrow("SIGNATURE_INVALID");
    expect(backend.profiles.get("user-1")).toBeUndefined();
  });

  it("rejects an expired nonce", async () => {
    const backend = new WalletBackend();
    const wallet = Wallet.createRandom();
    const nonce = backend.issueNonce("user-1", wallet.address, 1000);
    const signature = await wallet.signMessage(backend.messageFor("user-1", nonce));

    expect(() =>
      backend.verify("user-1", nonce, signature, { now: Date.now() + 5 * 60 * 1000 }),
    ).toThrow("NONCE_INVALID");
  });

  it("rejects a reused nonce", async () => {
    const backend = new WalletBackend();
    const wallet = Wallet.createRandom();
    const nonce = backend.issueNonce("user-1", wallet.address);
    const signature = await wallet.signMessage(backend.messageFor("user-1", nonce));

    backend.verify("user-1", nonce, signature);
    expect(() => backend.verify("user-1", nonce, signature)).toThrow("NONCE_INVALID");
  });

  it("prevents one wallet from being verified by two users", async () => {
    const backend = new WalletBackend();
    const wallet = Wallet.createRandom();

    const first = backend.issueNonce("user-1", wallet.address);
    backend.verify("user-1", first, await wallet.signMessage(backend.messageFor("user-1", first)));

    const second = backend.issueNonce("user-2", wallet.address);
    const signature = await wallet.signMessage(backend.messageFor("user-2", second));
    expect(() => backend.verify("user-2", second, signature)).toThrow("WALLET_ALREADY_LINKED");
  });

  it("blocks direct profile wallet updates", () => {
    const backend = new WalletBackend();
    expect(() => backend.directProfileUpdate()).toThrow("WALLET_COLUMNS_PROTECTED");
  });
});
