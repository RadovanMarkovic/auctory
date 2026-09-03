/**
 * Certificate RPCs. Only `.handler()` bodies run, and they run on the server.
 * All chain access and secrets live in `certificates.server.ts`, imported
 * dynamically inside handlers so nothing reaches the browser bundle.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function validateProductId(input: { productId: string }) {
  const id = input?.productId;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_PRODUCT");
  return { productId: id };
}

async function requestOrigin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const headers = getRequest().headers;
  const origin = headers.get("origin");
  if (origin) return origin;
  const host = headers.get("host");
  return host ? `https://${host}` : "";
}

/** Caller must own the product, hold the seller role and have a verified Sepolia wallet. */
async function authorizeSeller(
  supabase: Awaited<ReturnType<typeof requireSupabaseAuth>> extends never ? never : any,
  userId: string,
  productId: string,
) {
  const { data: product } = await supabase
    .from("products")
    .select("id, seller_id, status")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.seller_id !== userId) throw new Error("FORBIDDEN");

  const { data: isSeller } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "seller",
  });
  if (!isSeller) throw new Error("SELLER_ROLE_REQUIRED");

  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_address, wallet_network, wallet_verified_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.wallet_address || !profile.wallet_verified_at || profile.wallet_network !== "sepolia") {
    throw new Error("WALLET_REQUIRED");
  }
  return { wallet: profile.wallet_address as string };
}

/** Mint (or reconcile) the product's certificate. Idempotent. */
export const registerProductCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProductId)
  .handler(async ({ data, context }) => {
    const { wallet } = await authorizeSeller(context.supabase, context.userId, data.productId);
    const { registerCertificateOnChain, CertificateError } = await import("@/lib/certificates.server");
    try {
      return await registerCertificateOnChain({
        productId: data.productId,
        sellerId: context.userId,
        sellerWallet: wallet,
        origin: await requestOrigin(),
      });
    } catch (error) {
      if (error instanceof CertificateError) throw new Error(error.code);
      throw new Error("MINT_FAILED");
    }
  });

/** Read-only: re-reads `ownerOf` and syncs the stored current owner. */
export const refreshCertificateOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProductId)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("blockchain_certificates")
      .select("*")
      .eq("product_id", data.productId)
      .maybeSingle();
    if (!row) throw new Error("CERTIFICATE_NOT_FOUND");

    const { refreshOwnerFromChain, CertificateError } = await import("@/lib/certificates.server");
    try {
      return await refreshOwnerFromChain(row as never);
    } catch (error) {
      if (error instanceof CertificateError) throw new Error(error.code);
      throw new Error("CHAIN_UNAVAILABLE");
    }
  });

/** Re-hashes the stored manifest and compares it with the database and the contract. */
export const verifyCertificateIntegrity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProductId)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("blockchain_certificates")
      .select("*")
      .eq("product_id", data.productId)
      .maybeSingle();
    if (!row) throw new Error("CERTIFICATE_NOT_FOUND");

    const { verifyIntegrity, CertificateError } = await import("@/lib/certificates.server");
    try {
      return await verifyIntegrity(row as never);
    } catch (error) {
      if (error instanceof CertificateError) throw new Error(error.code);
      throw new Error("CHAIN_UNAVAILABLE");
    }
  });
