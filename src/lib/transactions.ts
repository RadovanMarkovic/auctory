import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";

export type TransactionStatus = Database["public"]["Enums"]["transaction_status"];
export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

export interface TransactionListItem extends TransactionRow {
  products: { title: string; brands: { name: string } | null } | null;
}

const SELECT = "*, products(title, brands(name))";

/** Statuses where confirmations are still accepted. */
export function isTransactionOpen(status: TransactionStatus) {
  return status === "awaiting_buyer" || status === "awaiting_seller";
}

export function canOpenDispute(status: TransactionStatus) {
  return status !== "disputed" && status !== "transferring_certificate" && status !== "completed";
}

/** All transactions the signed-in user may read (buyer, seller or admin). */
export function useMyTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<TransactionListItem[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TransactionListItem[];
    },
  });
}

export function useTransaction(transactionId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transaction", transactionId, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<TransactionListItem | null> => {
      const { data, error } = await supabase
        .from("transactions")
        .select(SELECT)
        .eq("id", transactionId)
        .maybeSingle();
      if (error) throw error;
      return (data as TransactionListItem | null) ?? null;
    },
  });
}

/** Transactions still waiting for the signed-in user's own confirmation. */
export function usePendingTransactions() {
  const { user } = useAuth();
  const query = useMyTransactions();
  const pending = (query.data ?? []).filter((row) => {
    if (!user || !isTransactionOpen(row.status)) return false;
    if (row.buyer_id === user.id && !row.buyer_confirmed_at) return true;
    if (row.seller_id === user.id && !row.seller_confirmed_at) return true;
    return false;
  });
  return { pending, isLoading: query.isLoading };
}

function useTransactionMutation<TVars>(fn: (vars: TVars) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transaction"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useConfirmAsBuyer() {
  return useTransactionMutation(async (transactionId: string) => {
    const { error } = await supabase.rpc("confirm_transaction_buyer", {
      _transaction_id: transactionId,
    });
    if (error) throw error;
  });
}

export function useConfirmAsSeller() {
  return useTransactionMutation(async (transactionId: string) => {
    const { error } = await supabase.rpc("confirm_transaction_seller", {
      _transaction_id: transactionId,
    });
    if (error) throw error;
  });
}

export function useOpenDispute() {
  return useTransactionMutation(async (vars: { transactionId: string; reason: string }) => {
    const { error } = await supabase.rpc("open_transaction_dispute", {
      _transaction_id: vars.transactionId,
      _reason: vars.reason,
    });
    if (error) throw error;
  });
}
