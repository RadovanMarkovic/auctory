/**
 * Client-side certificate helpers. Chain access happens only on the server.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  refreshCertificateOwner,
  registerProductCertificate,
  verifyCertificateIntegrity,
} from "@/lib/certificates.functions";

export type CertificateRow = Database["public"]["Tables"]["blockchain_certificates"]["Row"];
export type CertificateStatus = Database["public"]["Enums"]["certificate_status"];

export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export function explorerAddressUrl(address: string) {
  return `${SEPOLIA_EXPLORER}/address/${address}`;
}
export function explorerTxUrl(hash: string) {
  return `${SEPOLIA_EXPLORER}/tx/${hash}`;
}
export function explorerTokenUrl(contract: string, tokenId: string) {
  return `${SEPOLIA_EXPLORER}/token/${contract}?a=${tokenId}`;
}

export function certificateQueryKey(productId?: string | null) {
  return ["certificate", productId ?? null] as const;
}

export function useCertificate(productId?: string | null) {
  return useQuery({
    queryKey: certificateQueryKey(productId),
    enabled: Boolean(productId),
    queryFn: async (): Promise<CertificateRow | null> => {
      const { data, error } = await supabase
        .from("blockchain_certificates")
        .select("*")
        .eq("product_id", productId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** Maps a thrown server error onto a translation key under `certificates.errors`. */
export function certificateErrorKey(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const known = [
    "WALLET_REQUIRED",
    "SELLER_ROLE_REQUIRED",
    "FORBIDDEN",
    "PRODUCT_IMAGE_REQUIRED",
    "PRODUCT_IMAGE_UNREADABLE",
    "WRONG_CHAIN",
    "RPC_UNREACHABLE",
    "CONFIG_MISSING",
    "CONTRACT_NOT_DEPLOYED",
    "CONTRACT_PAUSED",
    "OPERATOR_MISSING_MINTER_ROLE",
    "OPERATOR_MISSING_TRANSFER_ROLE",
    "MINT_IN_PROGRESS",
    "MINT_PENDING",
    "MINT_TX_REVERTED",
    "MINT_EVENT_MISSING",
    "MINT_OWNER_MISMATCH",
    "CERTIFICATE_NOT_MINTED",
    "CERTIFICATE_NOT_FOUND",
  ];
  const match = known.find((code) => message.includes(code));
  return `certificates.errors.${match ?? "MINT_FAILED"}`;
}

export function useRegisterCertificate(productId?: string | null) {
  const register = useServerFn(registerProductCertificate);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => register({ data: { productId: productId! } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: certificateQueryKey(productId) });
      void queryClient.invalidateQueries({ queryKey: ["auctionable-products"] });
    },
  });
}

export function useRefreshCertificateOwner(productId?: string | null) {
  const refresh = useServerFn(refreshCertificateOwner);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => refresh({ data: { productId: productId! } }),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: certificateQueryKey(productId) }),
  });
}

export function useVerifyCertificate(productId?: string | null) {
  const verify = useServerFn(verifyCertificateIntegrity);
  return useMutation({
    mutationFn: async () => verify({ data: { productId: productId! } }),
  });
}
