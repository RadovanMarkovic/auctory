/**
 * Certificate transfer RPCs. Only `.handler()` bodies run, and they run on the
 * server. Chain access and secrets live in `transfers.server.ts`, imported
 * dynamically inside handlers so nothing reaches the browser bundle.
 *
 * The browser may only send a transaction id — wallets, token ids, references
 * and hashes are always derived server-side from existing rows.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function validateTransactionId(input: { transactionId: string }) {
  const id = input?.transactionId;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_TRANSACTION");
  return { transactionId: id };
}

/** Buyer, seller or admin only — enforced by the transaction's own RLS policy. */
async function authorizeParticipant(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  transactionId: string,
) {
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .eq("id", transactionId)
    .maybeSingle();
  if (!data) throw new Error("FORBIDDEN");
}

export interface TransferStatusResult {
  status: "completed" | "submitted" | "pending" | "failed";
  txHash?: string | null;
  blockNumber?: number | null;
  previousOwner?: string | null;
  newOwner?: string | null;
}

async function run(
  fn: () => Promise<TransferStatusResult>,
  fallback: string,
): Promise<TransferStatusResult> {
  const { TransferError } = await import("@/lib/transfers.server");
  try {
    return await fn();
  } catch (error) {
    if (error instanceof TransferError) throw new Error(error.code);
    throw new Error(fallback);
  }
}

/** Start (or resume) the on-chain certificate transfer. Idempotent. */
export const startCertificateTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateTransactionId)
  .handler(async ({ data, context }) => {
    await authorizeParticipant(context.supabase, data.transactionId);
    const { transferCertificateOnChain } = await import("@/lib/transfers.server");
    return run(() => transferCertificateOnChain(data.transactionId), "TRANSFER_FAILED");
  });

/** Reconcile a previous attempt; resubmits only after a proven failed receipt. */
export const reconcileCertificateTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateTransactionId)
  .handler(async ({ data, context }) => {
    await authorizeParticipant(context.supabase, data.transactionId);
    const { reconcileCertificateTransferOnChain } = await import("@/lib/transfers.server");
    return run(() => reconcileCertificateTransferOnChain(data.transactionId), "TRANSFER_FAILED");
  });
