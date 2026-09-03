/**
 * Server-only on-chain certificate transfer for completed auction transactions.
 *
 * Secrets (SEPOLIA_RPC_URL, OPERATOR_PRIVATE_KEY, AUCTORY_CONTRACT_ADDRESS) are
 * read only through `getChain()` and are never returned or logged. Every
 * authoritative value (wallets, token id, refs, hashes) is derived here from
 * existing database rows — the browser only supplies a transaction id.
 */

import { getAddress } from "ethers";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { CertificateError, getChain } from "@/lib/certificates.server";
import { productRefFor } from "@/lib/certificates/manifest";
import {
  buildSaleSnapshot,
  saleDataHash,
  saleRefFor,
  type SaleSnapshot,
} from "@/lib/certificates/sale";
import { SEPOLIA_CHAIN_ID } from "@/lib/wallet/message";

export { CertificateError as TransferError } from "@/lib/certificates.server";

export interface TransferResult {
  status: "completed" | "submitted" | "pending" | "failed";
  txHash?: string | null;
  blockNumber?: number | null;
  previousOwner?: string | null;
  newOwner?: string | null;
}

/**
 * Transfer preflight: chain id, bytecode, pause state and TRANSFER_ROLE only.
 * MINTER_ROLE is irrelevant to moving an already minted certificate.
 */
export async function transferPreflight() {
  const { provider, operator, contract, contractAddress } = getChain();

  const network = await provider.getNetwork().catch(() => {
    throw new CertificateError("RPC_UNREACHABLE");
  });
  if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) throw new CertificateError("WRONG_CHAIN");

  const code = await provider.getCode(contractAddress);
  if (!code || code === "0x") throw new CertificateError("CONTRACT_NOT_DEPLOYED");
  if (await contract['paused']!()) throw new CertificateError("CONTRACT_PAUSED");

  const transferRole = await contract['TRANSFER_ROLE']!();
  const operatorAddress = await operator.getAddress();
  if (!(await contract['hasRole']!(transferRole, operatorAddress))) {
    throw new CertificateError("OPERATOR_MISSING_TRANSFER_ROLE");
  }

  return { provider, contract, contractAddress };
}

interface Context {
  transaction: {
    id: string;
    auction_id: string;
    product_id: string;
    status: string;
    buyer_id: string;
    seller_id: string;
    final_price: number | string;
    bid_history_hash: string;
    buyer_confirmed_at: string | null;
    seller_confirmed_at: string | null;
  };
  certificate: {
    id: string;
    status: string;
    token_id: string | null;
    product_ref: string;
    contract_address: string | null;
    seller_wallet: string | null;
    current_owner_wallet: string | null;
  };
  transfer: {
    id: string;
    status: string;
    tx_hash: string | null;
    sale_ref: string;
    sale_data_hash: string;
    sale_snapshot: unknown;
    token_id: string;
    previous_owner_wallet: string;
    buyer_wallet: string;
    retry_count: number;
    block_number: number | null;
  } | null;
  buyerWallet: string;
}

async function loadContext(transactionId: string): Promise<Context> {
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();
  if (!transaction) throw new CertificateError("TRANSACTION_NOT_FOUND");

  const { data: certificate } = await supabaseAdmin
    .from("blockchain_certificates")
    .select("*")
    .eq("product_id", transaction.product_id)
    .maybeSingle();
  if (!certificate) throw new CertificateError("CERTIFICATE_NOT_FOUND");

  const { data: transfer } = await supabaseAdmin
    .from("ownership_transfers")
    .select("*")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  const { data: buyer } = await supabaseAdmin
    .from("profiles")
    .select("wallet_address, wallet_network, wallet_verified_at")
    .eq("id", transaction.buyer_id)
    .maybeSingle();

  if (
    !buyer?.wallet_address ||
    !buyer.wallet_verified_at ||
    buyer.wallet_network !== "sepolia"
  ) {
    throw new CertificateError("BUYER_WALLET_REQUIRED");
  }

  return {
    transaction: transaction as Context["transaction"],
    certificate: certificate as Context["certificate"],
    transfer: (transfer as Context["transfer"]) ?? null,
    buyerWallet: getAddress(buyer.wallet_address),
  };
}

/** Every eligibility rule. Throws a typed code on the first failure. */
async function assertEligible(context: Context, contractAddress: string) {
  const { transaction, certificate } = context;

  if (transaction.status === "disputed") throw new CertificateError("TRANSACTION_DISPUTED");
  if (!transaction.buyer_confirmed_at || !transaction.seller_confirmed_at) {
    throw new CertificateError("CONFIRMATIONS_MISSING");
  }

  const { data: auction } = await supabaseAdmin
    .from("auctions")
    .select("id, status, winner_id")
    .eq("id", transaction.auction_id)
    .maybeSingle();
  if (!auction || auction.status !== "ended" || auction.winner_id !== transaction.buyer_id) {
    throw new CertificateError("AUCTION_NOT_SOLD");
  }

  if (certificate.status !== "minted" || !certificate.token_id) {
    throw new CertificateError("CERTIFICATE_NOT_MINTED");
  }
  if (
    certificate.contract_address &&
    getAddress(certificate.contract_address) !== getAddress(contractAddress)
  ) {
    throw new CertificateError("CONTRACT_MISMATCH");
  }
}

function snapshotFor(context: Context, previousOwner: string): SaleSnapshot {
  const { transaction, certificate } = context;
  return buildSaleSnapshot({
    transactionId: transaction.id,
    auctionId: transaction.auction_id,
    productId: transaction.product_id,
    productRef: certificate.product_ref || productRefFor(transaction.product_id),
    tokenId: certificate.token_id!,
    sellerWallet: certificate.seller_wallet ?? previousOwner,
    buyerWallet: context.buyerWallet,
    finalPrice: transaction.final_price,
    bidHistoryHash: transaction.bid_history_hash,
    buyerConfirmedAt: transaction.buyer_confirmed_at!,
    sellerConfirmedAt: transaction.seller_confirmed_at!,
  });
}

function parseSaleCompleted(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contract: any,
  logs: readonly { topics: readonly string[]; data: string }[],
) {
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "SaleCompleted") return parsed;
    } catch {
      /* not one of ours */
    }
  }
  return null;
}

function assertEvent(
  event: { args: Record<string, unknown> },
  expected: { saleRef: string; productRef: string; tokenId: string; buyer: string; hash: string },
) {
  const args = event.args;
  const same = (a: unknown, b: string) => String(a).toLowerCase() === b.toLowerCase();
  if (
    !same(args['saleRef'], expected.saleRef) ||
    !same(args['productRef'], expected.productRef) ||
    String(args['tokenId']) !== expected.tokenId ||
    getAddress(String(args['buyer'])) !== getAddress(expected.buyer) ||
    !same(args['saleDataHash'], expected.hash)
  ) {
    throw new CertificateError("TRANSFER_EVENT_MISMATCH");
  }
}

async function finalize(params: {
  transactionId: string;
  txHash: string | null;
  blockNumber: number | null;
  owner: string;
  previousOwner: string;
}): Promise<TransferResult> {
  const { error } = await supabaseAdmin.rpc("finalize_certificate_transfer", {
    _transaction_id: params.transactionId,
    _tx_hash: params.txHash as string,
    _block_number: params.blockNumber as number,
    _owner_wallet: params.owner,
  });
  if (error) throw new CertificateError("TRANSFER_FINALIZE_FAILED", error.message);
  return {
    status: "completed",
    txHash: params.txHash,
    blockNumber: params.blockNumber,
    previousOwner: params.previousOwner,
    newOwner: params.owner,
  };
}

/**
 * Reads the chain and, when the sale already happened, reconciles the database.
 * Never submits a transaction.
 */
async function reconcileFromChain(context: Context): Promise<TransferResult | null> {
  const transfer = context.transfer;
  if (!transfer) return null;
  const { contract } = getChain();

  const processed: boolean = await contract['isSaleProcessed']!(transfer.sale_ref);
  if (!processed) return null;

  const owner: string = getAddress(await contract['ownerOf']!(transfer.token_id));
  let txHash = transfer.tx_hash;
  let blockNumber = transfer.block_number;

  if (!txHash || !blockNumber) {
    const logs = await contract
      .queryFilter(contract.filters['SaleCompleted']!(transfer.sale_ref), 0, "latest")
      .catch(() => []);
    const log = logs[0];
    if (log) {
      txHash = log.transactionHash;
      blockNumber = log.blockNumber;
    }
  }

  return finalize({
    transactionId: context.transaction.id,
    txHash,
    blockNumber,
    owner,
    previousOwner: transfer.previous_owner_wallet,
  });
}

/**
 * Idempotent transfer. A new transaction is submitted only when no previous
 * outcome is unknown and the chain does not already know the sale.
 */
export async function transferCertificateOnChain(transactionId: string): Promise<TransferResult> {
  const { contract, contractAddress, provider } = await transferPreflight();
  const context = await loadContext(transactionId);

  if (context.transaction.status === "completed" && context.transfer?.status === "completed") {
    return {
      status: "completed",
      txHash: context.transfer.tx_hash,
      blockNumber: context.transfer.block_number,
      previousOwner: context.transfer.previous_owner_wallet,
      newOwner: context.transfer.buyer_wallet,
    };
  }

  await assertEligible(context, contractAddress);

  // 1. A known previous submission decides everything.
  const existing = context.transfer;
  if (existing?.tx_hash && existing.status !== "failed") {
    const receipt = await provider.getTransactionReceipt(existing.tx_hash).catch(() => null);
    if (!receipt) {
      const reconciled = await reconcileFromChain(context);
      if (reconciled) return reconciled;
      throw new CertificateError("TRANSFER_PENDING");
    }
    if (receipt.status === 1) {
      const reconciled = await reconcileFromChain(context);
      if (reconciled) return reconciled;
      throw new CertificateError("TRANSFER_PENDING");
    }
    // Receipt proven failed → a new submission is allowed below.
    await supabaseAdmin.rpc("release_certificate_transfer", {
      _transaction_id: transactionId,
      _code: "TRANSFER_TX_REVERTED",
      _message: "receipt status 0",
    });
  }

  // 2. The chain may already know this sale even without a stored hash.
  const already = await reconcileFromChain(context);
  if (already) return already;

  // 3. Derive the on-chain owner and check it against the stored certificate.
  const tokenId = context.certificate.token_id!;
  const previousOwner = getAddress(await contract['ownerOf']!(tokenId));
  if (
    context.certificate.current_owner_wallet &&
    getAddress(context.certificate.current_owner_wallet) !== previousOwner
  ) {
    throw new CertificateError("OWNER_MISMATCH");
  }
  if (previousOwner === context.buyerWallet) {
    // Already with the buyer on-chain: reconcile the database, do not submit.
    const reconciled = await reconcileFromChain(context);
    if (reconciled) return reconciled;
  }

  const snapshot = (existing?.sale_snapshot as SaleSnapshot | undefined) ??
    snapshotFor(context, previousOwner);
  const hash = existing?.sale_data_hash ?? saleDataHash(snapshot);
  const saleRef = existing?.sale_ref ?? saleRefFor(transactionId);

  // 4. Atomic claim: concurrent callers cannot both proceed.
  const { error: claimError } = await supabaseAdmin.rpc("claim_certificate_transfer", {
    _transaction_id: transactionId,
    _auction_id: context.transaction.auction_id,
    _product_id: context.transaction.product_id,
    _certificate_id: context.certificate.id,
    _token_id: tokenId,
    _sale_ref: saleRef,
    _sale_data_hash: hash,
    _sale_snapshot: snapshot as unknown as Json,
    _previous_owner_wallet: previousOwner,
    _buyer_wallet: context.buyerWallet,
  });
  if (claimError) {
    const message = claimError.message ?? "";
    if (/TRANSFER_IN_PROGRESS/.test(message)) throw new CertificateError("TRANSFER_IN_PROGRESS");
    if (/TRANSFER_NOT_CLAIMABLE/.test(message)) throw new CertificateError("TRANSFER_NOT_CLAIMABLE");
    throw new CertificateError("TRANSFER_CLAIM_FAILED", message);
  }

  let submittedHash: string | null = null;
  try {
    const tx = await contract['completeSale']!(saleRef, snapshot.productRef, context.buyerWallet, hash);
    submittedHash = tx.hash;
    await supabaseAdmin.rpc("mark_certificate_transfer_submitted", {
      _transaction_id: transactionId,
      _tx_hash: tx.hash,
    });

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new CertificateError("TRANSFER_TX_REVERTED");

    const event = parseSaleCompleted(contract, receipt.logs);
    if (!event) throw new CertificateError("TRANSFER_EVENT_MISSING");
    assertEvent(event as unknown as { args: Record<string, unknown> }, {
      saleRef,
      productRef: snapshot.productRef,
      tokenId,
      buyer: context.buyerWallet,
      hash,
    });

    const owner = getAddress(await contract['ownerOf']!(tokenId));
    if (owner !== context.buyerWallet) throw new CertificateError("TRANSFER_OWNER_MISMATCH");

    return await finalize({
      transactionId,
      txHash: receipt.hash ?? submittedHash,
      blockNumber: receipt.blockNumber,
      owner,
      previousOwner,
    });
  } catch (error) {
    const code = error instanceof CertificateError ? error.code : "TRANSFER_FAILED";
    if (!submittedHash) {
      // Nothing was sent: safely return to ready_for_transfer.
      await supabaseAdmin.rpc("release_certificate_transfer", {
        _transaction_id: transactionId,
        _code: code,
        _message: (error as Error).message ?? code,
      });
      throw error instanceof CertificateError ? error : new CertificateError("TRANSFER_FAILED");
    }
    // A hash exists: stay in transferring_certificate until reconciliation.
    await supabaseAdmin
      .from("ownership_transfers")
      .update({ last_error_code: code, last_error_message: String((error as Error).message ?? code).slice(0, 500) })
      .eq("transaction_id", transactionId)
      .neq("status", "completed");
    throw error instanceof CertificateError ? error : new CertificateError("TRANSFER_PENDING");
  }
}

/**
 * Reconcile/retry. Reads the previous outcome first and only ever submits a new
 * transaction when a receipt explicitly proves the previous one failed.
 */
export async function reconcileCertificateTransferOnChain(
  transactionId: string,
): Promise<TransferResult> {
  const { provider } = await transferPreflight();
  const context = await loadContext(transactionId);
  const transfer = context.transfer;

  if (!transfer) return transferCertificateOnChain(transactionId);

  if (transfer.status === "completed") {
    return {
      status: "completed",
      txHash: transfer.tx_hash,
      blockNumber: transfer.block_number,
      previousOwner: transfer.previous_owner_wallet,
      newOwner: transfer.buyer_wallet,
    };
  }

  if (transfer.tx_hash) {
    const receipt = await provider.getTransactionReceipt(transfer.tx_hash).catch(() => null);
    if (!receipt) {
      // Outcome unknown: the chain decides, never a second submission.
      const reconciled = await reconcileFromChain(context);
      if (reconciled) return reconciled;
      throw new CertificateError("TRANSFER_PENDING");
    }
    if (receipt.status === 1) {
      const reconciled = await reconcileFromChain(context);
      if (reconciled) return reconciled;
      throw new CertificateError("TRANSFER_PENDING");
    }
    // Proven failed → release and resubmit.
    await supabaseAdmin.rpc("release_certificate_transfer", {
      _transaction_id: transactionId,
      _code: "TRANSFER_TX_REVERTED",
      _message: "receipt status 0",
    });
    return transferCertificateOnChain(transactionId);
  }

  const reconciled = await reconcileFromChain(context);
  if (reconciled) return reconciled;

  await supabaseAdmin.rpc("release_certificate_transfer", {
    _transaction_id: transactionId,
    _code: "TRANSFER_RETRY",
    _message: "no transaction was submitted",
  });
  return transferCertificateOnChain(transactionId);
}
