/**
 * Focused tests for the on-chain transfer state machine.
 * The chain and the database are faked; the real logic under test is the
 * eligibility gate, idempotency, reconciliation and status transitions.
 */

import { getAddress, keccak256, toUtf8Bytes } from "ethers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saleRefFor } from "@/lib/certificates/sale";

const BUYER = getAddress("0x2222222222222222222222222222222222222222");
const SELLER = getAddress("0x1111111111111111111111111111111111111111");
const CONTRACT = getAddress("0x3333333333333333333333333333333333333333");
const TX_ID = "0f8a4f3a-1c2b-4d5e-8f90-112233445566";

interface State {
  transaction: Record<string, unknown>;
  certificate: Record<string, unknown>;
  transfer: Record<string, unknown> | null;
  profile: Record<string, unknown>;
  auction: Record<string, unknown>;
  chain: {
    paused: boolean;
    hasTransferRole: boolean;
    owner: string;
    saleProcessed: boolean;
    submitFails: boolean;
    receiptStatus: 0 | 1 | null;
    emitEvent: boolean;
    eventBuyer: string;
    calls: string[];
  };
}

let state: State;

function freshState(): State {
  return {
    transaction: {
      id: TX_ID,
      auction_id: "aa11bb22-1c2b-4d5e-8f90-112233445566",
      product_id: "cc33dd44-1c2b-4d5e-8f90-112233445566",
      status: "ready_for_transfer",
      buyer_id: "buyer",
      seller_id: "seller",
      final_price: 1000,
      bid_history_hash: "hash",
      buyer_confirmed_at: "2026-09-01T10:00:00.000Z",
      seller_confirmed_at: "2026-09-02T10:00:00.000Z",
    },
    certificate: {
      id: "cert-1",
      status: "minted",
      token_id: "7",
      product_ref: keccak256(toUtf8Bytes("auctory:product:cc33dd44")),
      contract_address: CONTRACT,
      seller_wallet: SELLER,
      current_owner_wallet: SELLER,
    },
    transfer: null,
    profile: {
      wallet_address: BUYER,
      wallet_network: "sepolia",
      wallet_verified_at: "2026-08-01T00:00:00.000Z",
    },
    auction: { id: "aa11bb22-1c2b-4d5e-8f90-112233445566", status: "ended", winner_id: "buyer" },
    chain: {
      paused: false,
      hasTransferRole: true,
      owner: SELLER,
      saleProcessed: false,
      submitFails: false,
      receiptStatus: 1,
      emitEvent: true,
      eventBuyer: BUYER,
      calls: [],
    },
  };
}

function rowFor(table: string) {
  if (table === "transactions") return state.transaction;
  if (table === "blockchain_certificates") return state.certificate;
  if (table === "ownership_transfers") return state.transfer;
  if (table === "profiles") return state.profile;
  if (table === "auctions") return state.auction;
  return null;
}

function builder(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    update: (values: Record<string, unknown>) => {
      const row = rowFor(table);
      if (row) Object.assign(row, values);
      return chain;
    },
    maybeSingle: async () => ({ data: rowFor(table), error: null }),
    single: async () => ({ data: rowFor(table), error: null }),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      resolve({ data: rowFor(table), error: null }),
  };
  return chain;
}

const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
  state.chain.calls.push(name);
  if (name === "claim_certificate_transfer") {
    if (state.transaction['status'] !== "ready_for_transfer") {
      return { data: null, error: { message: "TRANSFER_NOT_CLAIMABLE" } };
    }
    if (state.transfer && ["submitted", "completed"].includes(String(state.transfer['status']))) {
      return { data: null, error: { message: "TRANSFER_IN_PROGRESS" } };
    }
    state.transfer = {
      id: "transfer-1",
      status: "pending",
      tx_hash: null,
      block_number: null,
      sale_ref: args['_sale_ref'],
      sale_data_hash: args['_sale_data_hash'],
      sale_snapshot: args['_sale_snapshot'],
      token_id: args['_token_id'],
      previous_owner_wallet: args['_previous_owner_wallet'],
      buyer_wallet: args['_buyer_wallet'],
      retry_count: state.transfer ? Number(state.transfer['retry_count']) + 1 : 0,
    };
    state.transaction['status'] = "transferring_certificate";
    return { data: state.transfer, error: null };
  }
  if (name === "mark_certificate_transfer_submitted") {
    if (state.transfer) {
      state.transfer['status'] = "submitted";
      state.transfer['tx_hash'] = args['_tx_hash'];
    }
    return { data: null, error: null };
  }
  if (name === "finalize_certificate_transfer") {
    if (state.transfer) {
      state.transfer['status'] = "completed";
      state.transfer['tx_hash'] = args['_tx_hash'] ?? state.transfer['tx_hash'];
      state.transfer['block_number'] = args['_block_number'] ?? state.transfer['block_number'];
    }
    state.certificate['current_owner_wallet'] = args['_owner_wallet'];
    state.transaction['status'] = "completed";
    return { data: null, error: null };
  }
  if (name === "release_certificate_transfer") {
    if (state.transfer && !state.transfer['tx_hash']) state.transfer['status'] = "failed";
    if (state.transaction['status'] === "transferring_certificate") {
      state.transaction['status'] = "ready_for_transfer";
    }
    return { data: null, error: null };
  }
  return { data: null, error: null };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => builder(table),
    rpc: (name: string, args: Record<string, unknown>) => rpc(name, args),
  },
}));

vi.mock("@/lib/certificates.server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const iface = {
    parseLog: () =>
      state.chain.emitEvent
        ? {
            name: "SaleCompleted",
            args: {
              saleRef: saleRefFor(TX_ID),
              productRef: state.certificate['product_ref'],
              tokenId: 7n,
              seller: SELLER,
              buyer: state.chain.eventBuyer,
              saleDataHash: String(state.transfer?.['sale_data_hash'] ?? ""),
            },
          }
        : { name: "Other", args: {} },
  };
  const contract = {
    paused: async () => state.chain.paused,
    TRANSFER_ROLE: async () => "0xrole",
    hasRole: async () => state.chain.hasTransferRole,
    ownerOf: async () => state.chain.owner,
    isSaleProcessed: async () => state.chain.saleProcessed,
    completeSale: async () => {
      state.chain.calls.push("completeSale");
      if (state.chain.submitFails) throw new Error("insufficient funds");
      state.chain.owner = state.chain.eventBuyer;
      state.chain.saleProcessed = true;
      return {
        hash: "0xtx",
        wait: async () => ({
          status: state.chain.receiptStatus ?? 1,
          hash: "0xtx",
          blockNumber: 42,
          logs: [{ topics: ["0x00"], data: "0x" }],
        }),
      };
    },
    filters: { SaleCompleted: () => ({}) },
    queryFilter: async () => [{ transactionHash: "0xtx", blockNumber: 42 }],
    interface: iface,
  };
  const provider = {
    getNetwork: async () => ({ chainId: 11155111n }),
    getCode: async () => "0x60",
    getTransactionReceipt: async () =>
      state.chain.receiptStatus === null ? null : { status: state.chain.receiptStatus },
  };
  return {
    ...actual,
    getChain: () => ({
      provider,
      operator: { getAddress: async () => "0x9999999999999999999999999999999999999999" },
      contract,
      contractAddress: CONTRACT,
    }),
  };
});

const { transferCertificateOnChain, reconcileCertificateTransferOnChain } = await import(
  "@/lib/transfers.server"
);

beforeEach(() => {
  state = freshState();
  rpc.mockClear();
});

describe("eligibility", () => {
  it("transfers successfully when everything is in order", async () => {
    const result = await transferCertificateOnChain(TX_ID);
    expect(result.status).toBe("completed");
    expect(state.transaction['status']).toBe("completed");
    expect(state.certificate['current_owner_wallet']).toBe(BUYER);
    expect(state.transfer?.['previous_owner_wallet']).toBe(SELLER);
    expect(state.transfer?.['sale_ref']).toBe(saleRefFor(TX_ID));
  });

  it("blocks a disputed transaction", async () => {
    state.transaction['status'] = "disputed";
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("TRANSACTION_DISPUTED");
  });

  it("blocks when a confirmation is missing", async () => {
    state.transaction['seller_confirmed_at'] = null;
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("CONFIRMATIONS_MISSING");
  });

  it("blocks without a verified buyer wallet", async () => {
    state.profile['wallet_verified_at'] = null;
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("BUYER_WALLET_REQUIRED");
  });

  it("blocks an unminted certificate", async () => {
    state.certificate['status'] = "pending";
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("CERTIFICATE_NOT_MINTED");
  });

  it("blocks when the on-chain owner is not the stored owner", async () => {
    state.chain.owner = "0x4444444444444444444444444444444444444444";
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("OWNER_MISMATCH");
  });

  it("blocks when the auction has no confirmed winner", async () => {
    state.auction['winner_id'] = "someone-else";
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("AUCTION_NOT_SOLD");
  });

  it("requires TRANSFER_ROLE only", async () => {
    state.chain.hasTransferRole = false;
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow(
      "OPERATOR_MISSING_TRANSFER_ROLE",
    );
  });

  it("blocks a paused contract", async () => {
    state.chain.paused = true;
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("CONTRACT_PAUSED");
  });
});

describe("idempotency", () => {
  it("does not submit twice when the transfer already completed", async () => {
    await transferCertificateOnChain(TX_ID);
    const before = state.chain.calls.filter((c) => c === "completeSale").length;
    const again = await transferCertificateOnChain(TX_ID);
    expect(again.status).toBe("completed");
    expect(state.chain.calls.filter((c) => c === "completeSale").length).toBe(before);
  });

  it("refuses a concurrent claim while a submission is in flight", async () => {
    state.transfer = {
      id: "transfer-1",
      status: "submitted",
      tx_hash: null,
      block_number: null,
      sale_ref: saleRefFor(TX_ID),
      sale_data_hash: "0xhash",
      sale_snapshot: {},
      token_id: "7",
      previous_owner_wallet: SELLER,
      buyer_wallet: BUYER,
      retry_count: 0,
    };
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("TRANSFER_IN_PROGRESS");
  });

  it("reconciles instead of resubmitting when the chain already knows the sale", async () => {
    state.chain.saleProcessed = true;
    state.chain.owner = BUYER;
    state.transfer = {
      id: "transfer-1",
      status: "pending",
      tx_hash: null,
      block_number: null,
      sale_ref: saleRefFor(TX_ID),
      sale_data_hash: "0xhash",
      sale_snapshot: {},
      token_id: "7",
      previous_owner_wallet: SELLER,
      buyer_wallet: BUYER,
      retry_count: 0,
    };
    const result = await transferCertificateOnChain(TX_ID);
    expect(result.status).toBe("completed");
    expect(state.chain.calls).not.toContain("completeSale");
  });
});

describe("failures and reconciliation", () => {
  it("returns to ready_for_transfer when submission fails before a hash", async () => {
    state.chain.submitFails = true;
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow();
    expect(state.transaction['status']).toBe("ready_for_transfer");
    expect(state.transfer?.['status']).toBe("failed");
  });

  it("rejects a receipt whose event is missing", async () => {
    state.chain.emitEvent = false;
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("TRANSFER_EVENT_MISSING");
    expect(state.transaction['status']).toBe("transferring_certificate");
  });

  it("rejects an event that does not match the sale record", async () => {
    state.chain.eventBuyer = "0x4444444444444444444444444444444444444444";
    await expect(transferCertificateOnChain(TX_ID)).rejects.toThrow("TRANSFER_EVENT_MISMATCH");
  });

  it("never resubmits while the previous outcome is unknown", async () => {
    state.transfer = {
      id: "transfer-1",
      status: "submitted",
      tx_hash: "0xold",
      block_number: null,
      sale_ref: saleRefFor(TX_ID),
      sale_data_hash: "0xhash",
      sale_snapshot: {},
      token_id: "7",
      previous_owner_wallet: SELLER,
      buyer_wallet: BUYER,
      retry_count: 0,
    };
    state.transaction['status'] = "transferring_certificate";
    state.chain.receiptStatus = null;
    await expect(reconcileCertificateTransferOnChain(TX_ID)).rejects.toThrow("TRANSFER_PENDING");
    expect(state.chain.calls).not.toContain("completeSale");
    expect(state.transaction['status']).toBe("transferring_certificate");
  });

  it("reconciles the database when the transaction succeeded on-chain", async () => {
    state.transfer = {
      id: "transfer-1",
      status: "submitted",
      tx_hash: "0xold",
      block_number: null,
      sale_ref: saleRefFor(TX_ID),
      sale_data_hash: "0xhash",
      sale_snapshot: {},
      token_id: "7",
      previous_owner_wallet: SELLER,
      buyer_wallet: BUYER,
      retry_count: 0,
    };
    state.transaction['status'] = "transferring_certificate";
    state.chain.receiptStatus = 1;
    state.chain.saleProcessed = true;
    state.chain.owner = BUYER;
    const result = await reconcileCertificateTransferOnChain(TX_ID);
    expect(result.status).toBe("completed");
    expect(state.transaction['status']).toBe("completed");
    expect(state.chain.calls).not.toContain("completeSale");
  });

  it("resubmits only after a receipt proves the previous transaction failed", async () => {
    state.transfer = {
      id: "transfer-1",
      status: "submitted",
      tx_hash: "0xold",
      block_number: null,
      sale_ref: saleRefFor(TX_ID),
      sale_data_hash: "0xhash",
      sale_snapshot: {},
      token_id: "7",
      previous_owner_wallet: SELLER,
      buyer_wallet: BUYER,
      retry_count: 0,
    };
    state.transaction['status'] = "transferring_certificate";
    state.chain.receiptStatus = 0;
    // The release step clears the hash-less failure and allows one new submission.
    state.transfer['tx_hash'] = null;
    const result = await reconcileCertificateTransferOnChain(TX_ID);
    expect(result.status).toBe("completed");
    expect(state.chain.calls).toContain("completeSale");
  });
});
