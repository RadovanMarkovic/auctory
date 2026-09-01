/**
 * Wallet verification RPCs. Only `.handler()` bodies run — and they run on the
 * server exclusively; the client bundle keeps nothing but the RPC stub.
 * The acting user always comes from the validated session, never from input.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildWalletMessage, SEPOLIA_NETWORK } from "@/lib/wallet/message";

const NONCE_TTL_MS = 5 * 60 * 1000;

/** Server-only: the Auctory origin is part of the signed message. */
async function requestDomain() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const headers = getRequest().headers;
  const origin = headers.get("origin");
  if (origin) return origin.replace(/^https?:\/\//, "");
  return headers.get("host") ?? "auctory";
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Issue a short-lived, single-use nonce bound to the caller and address. */
export const requestWalletNonce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { address: string }) => {
    if (!isAddress(input?.address)) throw new Error("INVALID_ADDRESS");
    return { address: input.address };
  })
  .handler(async ({ data, context }) => {
    const { getAddress } = await import("ethers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const address = getAddress(data.address);
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

    const { error } = await supabaseAdmin.rpc("issue_wallet_nonce", {
      _user_id: context.userId,
      _address: address,
      _nonce: nonce,
      _expires_at: expiresAt,
    });
    if (error) throw new Error("NONCE_ISSUE_FAILED");

    return {
      nonce,
      expiresAt,
      message: buildWalletMessage({
        domain: await requestDomain(),
        userId: context.userId,
        address,
        nonce,
        expiresAt,
      }),
    };
  });

/**
 * Verify the signature and, only then, store the wallet on the caller's profile.
 * An address without a matching signature is never stored.
 */
export const verifyWalletSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nonce: string; signature: string }) => {
    if (typeof input?.nonce !== "string" || input.nonce.length < 8) throw new Error("INVALID_NONCE");
    if (typeof input?.signature !== "string" || !input.signature.startsWith("0x")) {
      throw new Error("INVALID_SIGNATURE");
    }
    return { nonce: input.nonce, signature: input.signature };
  })
  .handler(async ({ data, context }) => {
    const { getAddress, verifyMessage } = await import("ethers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Conditional single-use consumption: a replayed or expired nonce yields no row.
    const { data: rows, error: consumeError } = await supabaseAdmin.rpc("consume_wallet_nonce", {
      _user_id: context.userId,
      _nonce: data.nonce,
    });
    if (consumeError) throw new Error("NONCE_INVALID");
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) throw new Error("NONCE_INVALID");

    const address = getAddress(row.address);
    const message = buildWalletMessage({
      domain: await requestDomain(),
      userId: context.userId,
      address,
      nonce: data.nonce,
      expiresAt: new Date(row.expires_at).toISOString(),
    });

    let recovered: string;
    try {
      recovered = getAddress(verifyMessage(message, data.signature));
    } catch {
      throw new Error("SIGNATURE_INVALID");
    }
    if (recovered !== address) throw new Error("SIGNATURE_INVALID");

    const { error: linkError } = await supabaseAdmin.rpc("link_verified_wallet", {
      _user_id: context.userId,
      _address: address,
    });
    if (linkError) {
      if (/WALLET_ALREADY_LINKED/.test(linkError.message)) throw new Error("WALLET_ALREADY_LINKED");
      throw new Error("WALLET_LINK_FAILED");
    }

    return { address, network: SEPOLIA_NETWORK, verifiedAt: new Date().toISOString() };
  });
