import { keccak256, toUtf8Bytes } from "ethers";
import { describe, expect, it } from "vitest";

import { canonicalize } from "./manifest";
import {
  buildSaleSnapshot,
  normalizePrice,
  saleDataHash,
  saleRefFor,
  type BuildSaleSnapshotInput,
} from "./sale";

const TX = "0f8a4f3a-1c2b-4d5e-8f90-112233445566";

const input: BuildSaleSnapshotInput = {
  transactionId: TX,
  auctionId: "aa11bb22-1c2b-4d5e-8f90-112233445566",
  productId: "cc33dd44-1c2b-4d5e-8f90-112233445566",
  productRef: keccak256(toUtf8Bytes("auctory:product:cc33dd44")),
  tokenId: "7",
  sellerWallet: "0x1111111111111111111111111111111111111111",
  buyerWallet: "0x2222222222222222222222222222222222222222",
  finalPrice: 1234.5,
  bidHistoryHash: "d41d8cd98f00b204e9800998ecf8427e",
  buyerConfirmedAt: "2026-09-01T10:00:00.000Z",
  sellerConfirmedAt: "2026-09-02T11:30:00.000Z",
};

describe("saleRef", () => {
  it("is keccak256 of the namespaced transaction id", () => {
    expect(saleRefFor(TX)).toBe(keccak256(toUtf8Bytes(`auctory:sale:${TX}`)));
  });

  it("differs per transaction", () => {
    expect(saleRefFor("a")).not.toBe(saleRefFor("b"));
  });
});

describe("price normalization", () => {
  it("produces a fixed-scale decimal string", () => {
    expect(normalizePrice(1234.5)).toBe("1234.50");
    expect(normalizePrice("1234.5")).toBe("1234.50");
    expect(normalizePrice("1234.500")).toBe("1234.50");
    expect(normalizePrice("0007.10")).toBe("7.10");
    expect(normalizePrice(0)).toBe("0.00");
  });

  it("rejects non-numeric input", () => {
    expect(() => normalizePrice("1,234")).toThrow("SALE_INVALID_PRICE");
  });
});

describe("sale snapshot", () => {
  it("stores the final price as a string, not a float", () => {
    const snapshot = buildSaleSnapshot(input);
    expect(snapshot.finalPrice).toBe("1234.50");
    expect(typeof snapshot.finalPrice).toBe("string");
  });

  it("normalizes wallets to checksum form", () => {
    const snapshot = buildSaleSnapshot({
      ...input,
      buyerWallet: "0x2222222222222222222222222222222222222222".toLowerCase(),
    });
    expect(snapshot.buyerWallet).toBe("0x2222222222222222222222222222222222222222");
  });

  it("is byte-for-byte stable and hash-stable across rebuilds", () => {
    const a = canonicalize(buildSaleSnapshot(input));
    const b = canonicalize(buildSaleSnapshot({ ...input, finalPrice: "1234.5" }));
    expect(a).toBe(b);
    expect(saleDataHash(buildSaleSnapshot(input))).toBe(saleDataHash(JSON.parse(b)));
  });

  it("changes the hash when any field changes", () => {
    const base = saleDataHash(buildSaleSnapshot(input));
    expect(saleDataHash(buildSaleSnapshot({ ...input, finalPrice: 1234.51 }))).not.toBe(base);
    expect(saleDataHash(buildSaleSnapshot({ ...input, tokenId: "8" }))).not.toBe(base);
  });

  it("hashes the canonical document with keccak256", () => {
    const snapshot = buildSaleSnapshot(input);
    expect(saleDataHash(snapshot)).toBe(keccak256(toUtf8Bytes(canonicalize(snapshot))));
  });
});
