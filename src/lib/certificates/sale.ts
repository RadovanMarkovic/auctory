/**
 * Deterministic post-auction sale snapshot + hashing.
 *
 * Pure module (ethers hashing only): no I/O, no secrets. Canonical JSON rules
 * and keccak256 are shared with the certificate manifest module.
 */

import { getAddress, keccak256, toUtf8Bytes } from "ethers";

import { canonicalize } from "./manifest";

export const SALE_SCHEMA_VERSION = 1;
export const SALE_CURRENCY = "EUR";
/** Scale of the stored numeric price column. */
export const PRICE_SCALE = 2;

export interface SaleSnapshot {
  schemaVersion: number;
  transactionId: string;
  auctionId: string;
  productId: string;
  productRef: string;
  tokenId: string;
  sellerWallet: string;
  buyerWallet: string;
  /** Normalized decimal string, never a floating point number. */
  finalPrice: string;
  currency: string;
  bidHistoryHash: string;
  buyerConfirmedAt: string;
  sellerConfirmedAt: string;
}

/** keccak256 of the UTF-8 bytes of `auctory:sale:<transaction-id>`. */
export function saleRefFor(transactionId: string): string {
  return keccak256(toUtf8Bytes(`auctory:sale:${transactionId}`));
}

/**
 * Normalizes a database numeric into a fixed-scale decimal string.
 * Accepts the string form PostgREST may return as well as a number.
 */
export function normalizePrice(value: string | number): string {
  const raw = typeof value === "number" ? value.toFixed(PRICE_SCALE) : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error("SALE_INVALID_PRICE");
  const negative = raw.startsWith("-");
  const [intPart = "0", fracPart = ""] = raw.replace("-", "").split(".");
  const frac = (fracPart + "0".repeat(PRICE_SCALE)).slice(0, PRICE_SCALE);
  const int = intPart.replace(/^0+(?=\d)/, "");
  return `${negative ? "-" : ""}${int}.${frac}`;
}

/** One canonical on-chain address form for every wallet in the snapshot. */
export function normalizeWallet(address: string): string {
  return getAddress(address);
}

export interface BuildSaleSnapshotInput {
  transactionId: string;
  auctionId: string;
  productId: string;
  productRef: string;
  tokenId: string;
  sellerWallet: string;
  buyerWallet: string;
  finalPrice: string | number;
  bidHistoryHash: string;
  buyerConfirmedAt: string;
  sellerConfirmedAt: string;
}

export function buildSaleSnapshot(input: BuildSaleSnapshotInput): SaleSnapshot {
  return {
    schemaVersion: SALE_SCHEMA_VERSION,
    transactionId: input.transactionId,
    auctionId: input.auctionId,
    productId: input.productId,
    productRef: input.productRef,
    tokenId: input.tokenId,
    sellerWallet: normalizeWallet(input.sellerWallet),
    buyerWallet: normalizeWallet(input.buyerWallet),
    finalPrice: normalizePrice(input.finalPrice),
    currency: SALE_CURRENCY,
    bidHistoryHash: input.bidHistoryHash,
    buyerConfirmedAt: new Date(input.buyerConfirmedAt).toISOString(),
    sellerConfirmedAt: new Date(input.sellerConfirmedAt).toISOString(),
  };
}

/** keccak256 of the canonical JSON snapshot document. */
export function saleDataHash(snapshot: unknown): string {
  return keccak256(toUtf8Bytes(canonicalize(snapshot)));
}
