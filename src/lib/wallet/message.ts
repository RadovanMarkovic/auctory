/**
 * Wallet verification message. Shared by the browser (display only) and the
 * server (build + verify). Pure and browser-safe: no secrets, no I/O.
 */

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
export const SEPOLIA_NETWORK = "sepolia";

export interface WalletMessageParts {
  domain: string;
  userId: string;
  address: string;
  nonce: string;
  expiresAt: string;
}

/** Exact message the user signs. Any change here invalidates open nonces. */
export function buildWalletMessage({
  domain,
  userId,
  address,
  nonce,
  expiresAt,
}: WalletMessageParts) {
  return [
    "Auctory wallet verification",
    `Domain: ${domain}`,
    `User: ${userId}`,
    `Address: ${address}`,
    `Chain: ${SEPOLIA_CHAIN_ID} (Sepolia)`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
  ].join("\n");
}

export function shortenAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function sameAddress(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}
