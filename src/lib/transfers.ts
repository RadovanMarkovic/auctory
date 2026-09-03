/**
 * Client-side certificate transfer helpers. Chain access happens on the server.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  reconcileCertificateTransfer,
  startCertificateTransfer,
} from "@/lib/transfers.functions";

export type TransferRow = Database["public"]["Tables"]["ownership_transfers"]["Row"];
export type TransferStatus = Database["public"]["Enums"]["ownership_transfer_status"];

export interface PublicTransfer {
  previous_owner_wallet: string;
  buyer_wallet: string;
  tx_hash: string | null;
  block_number: number | null;
  completed_at: string | null;
}

export function transferQueryKey(transactionId?: string | null) {
  return ["ownership-transfer", transactionId ?? null] as const;
}

/** Private transfer record — visible to buyer, seller and admins only. */
export function useOwnershipTransfer(transactionId?: string | null) {
  return useQuery({
    queryKey: transferQueryKey(transactionId),
    enabled: Boolean(transactionId),
    queryFn: async (): Promise<TransferRow | null> => {
      const { data, error } = await supabase
        .from("ownership_transfers")
        .select("*")
        .eq("transaction_id", transactionId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** Safe public subset for the digital passport of publicly visible auctions. */
export function usePublicTransfer(productId?: string | null) {
  return useQuery({
    queryKey: ["public-transfer", productId ?? null],
    enabled: Boolean(productId),
    queryFn: async (): Promise<PublicTransfer | null> => {
      const { data, error } = await supabase.rpc("public_certificate_transfer", {
        _product_id: productId!,
      });
      if (error) throw error;
      return ((data as PublicTransfer[] | null) ?? [])[0] ?? null;
    },
  });
}

const KNOWN_ERRORS = [
  "FORBIDDEN",
  "INVALID_TRANSACTION",
  "TRANSACTION_NOT_FOUND",
  "TRANSACTION_DISPUTED",
  "CONFIRMATIONS_MISSING",
  "AUCTION_NOT_SOLD",
  "BUYER_WALLET_REQUIRED",
  "CERTIFICATE_NOT_FOUND",
  "CERTIFICATE_NOT_MINTED",
  "CONTRACT_MISMATCH",
  "OWNER_MISMATCH",
  "TRANSFER_NOT_CLAIMABLE",
  "TRANSFER_IN_PROGRESS",
  "TRANSFER_PENDING",
  "TRANSFER_TX_REVERTED",
  "TRANSFER_EVENT_MISSING",
  "TRANSFER_EVENT_MISMATCH",
  "TRANSFER_OWNER_MISMATCH",
  "TRANSFER_FINALIZE_FAILED",
  "WRONG_CHAIN",
  "RPC_UNREACHABLE",
  "CONFIG_MISSING",
  "CONTRACT_NOT_DEPLOYED",
  "CONTRACT_PAUSED",
  "OPERATOR_MISSING_TRANSFER_ROLE",
];

/** Maps a thrown server error onto a translation key under `transfers.errors`. */
export function transferErrorKey(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = KNOWN_ERRORS.find((code) => message.includes(code));
  return `transfers.errors.${match ?? "TRANSFER_FAILED"}`;
}

function useTransferMutation(
  transactionId: string,
  fn: (vars: { data: { transactionId: string } }) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fn({ data: { transactionId } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: transferQueryKey(transactionId) });
      void queryClient.invalidateQueries({ queryKey: ["transaction"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["certificate"] });
    },
  });
}

export function useStartTransfer(transactionId: string) {
  const start = useServerFn(startCertificateTransfer);
  return useTransferMutation(transactionId, start as never);
}

export function useReconcileTransfer(transactionId: string) {
  const reconcile = useServerFn(reconcileCertificateTransfer);
  return useTransferMutation(transactionId, reconcile as never);
}
