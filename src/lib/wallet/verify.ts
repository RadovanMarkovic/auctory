/**
 * Client-side wallet verification flow: connect → nonce → signature → server
 * verification. The signature is always produced by MetaMask; the server never
 * trusts an address on its own.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { requestWalletNonce, verifyWalletSignature } from "@/lib/wallet.functions";
import { signMessage, switchToSepolia, WalletError } from "./metamask";
import { SEPOLIA_NETWORK } from "./message";

export interface VerifiedWallet {
  address: string | null;
  network: string | null;
  verifiedAt: string | null;
}

/** The wallet stored on the signed-in user's profile (server-verified). */
export function useVerifiedWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["verified-wallet", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<VerifiedWallet> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("wallet_address, wallet_network, wallet_verified_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        address: data?.wallet_address ?? null,
        network: data?.wallet_network ?? null,
        verifiedAt: data?.wallet_verified_at ?? null,
      };
    },
  });
}

export function isSepoliaVerified(wallet?: VerifiedWallet | null) {
  return Boolean(wallet?.address && wallet.verifiedAt && wallet.network === SEPOLIA_NETWORK);
}

/** Sign the server-issued message and store the wallet after verification. */
export function useVerifyWallet() {
  const queryClient = useQueryClient();
  const requestNonce = useServerFn(requestWalletNonce);
  const verifySignature = useServerFn(verifyWalletSignature);

  return useMutation({
    mutationFn: async (address: string) => {
      await switchToSepolia();
      const { nonce, message } = await requestNonce({ data: { address } });
      const signature = await signMessage(address, message);
      return await verifySignature({ data: { nonce, signature } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["verified-wallet"] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** Map any verification failure to a translation key under `wallet.errors`. */
export function walletErrorKey(error: unknown): string {
  if (error instanceof WalletError) return error.code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("WALLET_ALREADY_LINKED")) return "alreadyLinked";
  if (message.includes("NONCE_INVALID")) return "nonceInvalid";
  if (message.includes("SIGNATURE_INVALID")) return "signatureInvalid";
  if (message.includes("INVALID_ADDRESS")) return "invalidAddress";
  if (message.includes("Unauthorized")) return "unauthorized";
  return "unknown";
}
