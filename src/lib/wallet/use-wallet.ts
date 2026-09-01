/**
 * Shared MetaMask connection state (browser only).
 * A tiny module store keeps the header button and the profile card in sync
 * without adding another React context provider.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  connectWallet,
  getChainId,
  getConnectedAccounts,
  hasMetaMask,
  isSepolia,
  onWalletEvent,
  switchToSepolia,
  WalletError,
} from "./metamask";

export interface WalletState {
  available: boolean;
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  /** Last error code surfaced to the UI (translated at render time). */
  error: string | null;
}

let state: WalletState = {
  available: false,
  address: null,
  chainId: null,
  connecting: false,
  error: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<WalletState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot: WalletState = {
  available: false,
  address: null,
  chainId: null,
  connecting: false,
  error: null,
};

export function useWallet() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => serverSnapshot,
  );

  useEffect(() => {
    let cancelled = false;
    const available = hasMetaMask();
    setState({ available });
    if (!available) return;

    void (async () => {
      const [accounts, chainId] = await Promise.all([getConnectedAccounts(), getChainId()]);
      if (cancelled) return;
      setState({ address: accounts[0] ?? null, chainId });
    })();

    // Account switch resets only the local connection; the verified wallet in
    // the database is never touched here.
    const offAccounts = onWalletEvent("accountsChanged", (accounts) => {
      const next = (accounts as unknown as string[])[0] ?? null;
      setState({ address: next, error: null });
    });
    const offChain = onWalletEvent("chainChanged", (hex) => {
      setState({ chainId: Number.parseInt(hex as unknown as string, 16) });
    });

    return () => {
      cancelled = true;
      offAccounts();
      offChain();
    };
  }, []);

  const connect = useCallback(async () => {
    setState({ connecting: true, error: null });
    try {
      const address = await connectWallet();
      const chainId = await getChainId();
      setState({ address, chainId });
      return address;
    } catch (error) {
      setState({ error: error instanceof WalletError ? error.code : "unknown" });
      return null;
    } finally {
      setState({ connecting: false });
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    setState({ error: null });
    try {
      await switchToSepolia();
      setState({ chainId: await getChainId() });
      return true;
    } catch (error) {
      setState({ error: error instanceof WalletError ? error.code : "unknown" });
      return false;
    }
  }, []);

  /** Logical disconnect: MetaMask has no revoke API, so we clear local state only. */
  const disconnect = useCallback(() => {
    setState({ address: null, error: null });
  }, []);

  const clearError = useCallback(() => setState({ error: null }), []);

  return {
    ...snapshot,
    onSepolia: isSepolia(snapshot.chainId),
    connect,
    switchNetwork,
    disconnect,
    clearError,
  };
}
