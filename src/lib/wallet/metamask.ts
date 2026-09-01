/**
 * MetaMask (EIP-1193) helpers. Browser-only: every function must be called
 * from an effect or an event handler, never during render or SSR.
 * Private keys never leave the wallet — we only request accounts and signatures.
 */

import { SEPOLIA_CHAIN_ID, SEPOLIA_CHAIN_ID_HEX } from "./message";

export type WalletErrorCode =
  | "no_metamask"
  | "rejected"
  | "pending"
  | "wrong_network"
  | "unknown";

export class WalletError extends Error {
  code: WalletErrorCode;
  constructor(code: WalletErrorCode, message?: string) {
    super(message ?? code);
    this.name = "WalletError";
    this.code = code;
  }
}

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
  isMetaMask?: boolean;
  providers?: Eip1193Provider[];
}

export function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  if (!injected) return null;
  if (injected.providers?.length) {
    return injected.providers.find((p) => p.isMetaMask) ?? injected.providers[0] ?? injected;
  }
  return injected;
}

export function hasMetaMask() {
  return getProvider() !== null;
}

function toWalletError(error: unknown): WalletError {
  const code = (error as { code?: number | string } | null)?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return new WalletError("rejected");
  if (code === -32002) return new WalletError("pending");
  const message = error instanceof Error ? error.message : String(error);
  return new WalletError("unknown", message);
}

async function request<T>(method: string, params?: unknown[] | object): Promise<T> {
  const provider = getProvider();
  if (!provider) throw new WalletError("no_metamask");
  try {
    return (await provider.request({ method, ...(params ? { params } : {}) })) as T;
  } catch (error) {
    throw toWalletError(error);
  }
}

export async function getChainId(): Promise<number | null> {
  const provider = getProvider();
  if (!provider) return null;
  const hex = await request<string>("eth_chainId");
  return Number.parseInt(hex, 16);
}

/** Accounts already authorised for this site — never prompts. */
export async function getConnectedAccounts(): Promise<string[]> {
  const provider = getProvider();
  if (!provider) return [];
  return await request<string[]>("eth_accounts");
}

export async function connectWallet(): Promise<string> {
  const accounts = await request<string[]>("eth_requestAccounts");
  const account = accounts[0];
  if (!account) throw new WalletError("rejected");
  return account;
}

/** Ask MetaMask to switch to Sepolia, adding the chain when it is unknown. */
export async function switchToSepolia(): Promise<void> {
  try {
    await request("wallet_switchEthereumChain", [{ chainId: SEPOLIA_CHAIN_ID_HEX }]);
  } catch (error) {
    const walletError = error instanceof WalletError ? error : toWalletError(error);
    const raw = (error as { message?: string }).message ?? "";
    if (walletError.code === "unknown" && /4902|Unrecognized chain/i.test(raw)) {
      await request("wallet_addEthereumChain", [
        {
          chainId: SEPOLIA_CHAIN_ID_HEX,
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ]);
      return;
    }
    throw walletError;
  }
}

export async function signMessage(address: string, message: string): Promise<string> {
  return await request<string>("personal_sign", [message, address]);
}

export function isSepolia(chainId: number | null) {
  return chainId === SEPOLIA_CHAIN_ID;
}

export function onWalletEvent(
  event: "accountsChanged" | "chainChanged",
  handler: (payload: never) => void,
) {
  const provider = getProvider();
  if (!provider?.on) return () => {};
  provider.on(event, handler as (...args: never[]) => void);
  return () => provider.removeListener?.(event, handler as (...args: never[]) => void);
}
