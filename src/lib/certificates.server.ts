/**
 * Server-only certificate logic: chain access, immutable storage, minting and
 * reconciliation. Never imported from client-reachable modules at module scope.
 *
 * Secrets (SEPOLIA_RPC_URL, OPERATOR_PRIVATE_KEY, AUCTORY_CONTRACT_ADDRESS) are
 * read inside functions only and never returned or logged.
 */

import { Contract, JsonRpcProvider, Wallet, getAddress, isAddress } from "ethers";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AUCTORY_CERTIFICATE_ABI } from "@/lib/certificates/abi.server";
import {
  CERTIFICATE_NETWORK,
  buildManifest,
  canonicalize,
  hashBytes,
  manifestHash,
  productRefFor,
  type CertificateManifest,
} from "@/lib/certificates/manifest";
import { SEPOLIA_CHAIN_ID } from "@/lib/wallet/message";

export const CERTIFICATE_BUCKET = "certificate-metadata";
export const PRODUCT_IMAGES_BUCKET = "product-images";
/** A `minting` row older than this may be reclaimed — through reconciliation only. */
const STALE_MINTING_MS = 10 * 60 * 1000;

export class CertificateError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "CertificateError";
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new CertificateError("CONFIG_MISSING", `Missing ${name}`);
  return value;
}

export function getChain() {
  const provider = new JsonRpcProvider(env("SEPOLIA_RPC_URL"), undefined, {
    staticNetwork: true,
  });
  const operator = new Wallet(env("OPERATOR_PRIVATE_KEY"), provider);
  const contractAddress = getAddress(env("AUCTORY_CONTRACT_ADDRESS"));
  const contract = new Contract(contractAddress, AUCTORY_CERTIFICATE_ABI, operator);
  return { provider, operator, contract, contractAddress };
}

/** Chain id, bytecode, pause state and operator roles. Throws a typed config error. */
export async function preflight() {
  const { provider, operator, contract, contractAddress } = getChain();

  const network = await provider.getNetwork().catch(() => {
    throw new CertificateError("RPC_UNREACHABLE");
  });
  if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new CertificateError("WRONG_CHAIN");
  }

  const code = await provider.getCode(contractAddress);
  if (!code || code === "0x") throw new CertificateError("CONTRACT_NOT_DEPLOYED");

  if (await contract['paused']!()) throw new CertificateError("CONTRACT_PAUSED");

  const minterRole = await contract['MINTER_ROLE']!();
  const transferRole = await contract['TRANSFER_ROLE']!();
  const operatorAddress = await operator.getAddress();
  const [hasMinter, hasTransfer] = await Promise.all([
    contract['hasRole']!(minterRole, operatorAddress),
    contract['hasRole']!(transferRole, operatorAddress),
  ]);
  if (!hasMinter) throw new CertificateError("OPERATOR_MISSING_MINTER_ROLE");
  if (!hasTransfer) throw new CertificateError("OPERATOR_MISSING_TRANSFER_ROLE");

  return { contract, contractAddress, operatorAddress, provider };
}

/** Public, immutable URL served by the read-only certificate route. */
export function publicUrl(origin: string, path: string) {
  return `${origin.replace(/\/$/, "")}/api/public/certificates/${path}`;
}

/** Write-once upload: an existing object is never overwritten (content-hash path). */
async function putOnce(path: string, body: Uint8Array, contentType: string) {
  const { error } = await supabaseAdmin.storage
    .from(CERTIFICATE_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  if (error && !/exists/i.test(error.message)) {
    throw new CertificateError("STORAGE_WRITE_FAILED", error.message);
  }
  return path;
}

function extensionFor(storagePath: string) {
  const match = /\.([a-z0-9]+)$/i.exec(storagePath);
  return (match?.[1] ?? "jpg").toLowerCase();
}

interface ProductImageRow {
  storage_path: string;
  is_cover: boolean;
  sort_order: number;
  id: string;
}

/** Hashes every image's raw bytes and copies only the cover into public storage. */
async function snapshotImages(images: ProductImageRow[], origin: string) {
  const ordered = [...images].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const cover = ordered.find((image) => image.is_cover) ?? ordered[0];
  if (!cover) throw new CertificateError("PRODUCT_IMAGE_REQUIRED");

  const hashes: string[] = [];
  let imageUrl = "";

  for (const image of ordered) {
    const { data, error } = await supabaseAdmin.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .download(image.storage_path);
    if (error || !data) throw new CertificateError("PRODUCT_IMAGE_UNREADABLE");
    const bytes = new Uint8Array(await data.arrayBuffer());
    const hash = hashBytes(bytes);
    hashes.push(hash);

    if (image.id === cover.id) {
      const path = `${CERTIFICATE_NETWORK}/images/${hash.slice(2)}.${extensionFor(image.storage_path)}`;
      await putOnce(path, bytes, data.type || "image/jpeg");
      imageUrl = publicUrl(origin, path);
    }
  }

  return { hashes, imageUrl };
}

export interface CertificateRow {
  id: string;
  product_id: string;
  seller_id: string;
  status: "pending" | "minting" | "minted" | "failed";
  product_ref: string;
  manifest: unknown;
  snapshot_at: string | null;
  metadata_hash: string | null;
  metadata_uri: string | null;
  seller_wallet: string | null;
  contract_address: string | null;
  token_id: string | null;
  mint_tx_hash: string | null;
  mint_block_number: number | null;
  current_owner_wallet: string | null;
  retry_count: number;
  updated_at: string;
}

async function loadCertificate(productId: string) {
  const { data } = await supabaseAdmin
    .from("blockchain_certificates")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  return (data as CertificateRow | null) ?? null;
}

/** Ensures the pending row exists. The manifest + snapshotAt are written once. */
async function ensureCertificateRow(params: {
  productId: string;
  sellerId: string;
  sellerWallet: string;
  origin: string;
}): Promise<CertificateRow> {
  const existing = await loadCertificate(params.productId);
  if (existing?.manifest && existing.metadata_hash) return existing;

  if (!existing) {
    const { error } = await supabaseAdmin.from("blockchain_certificates").insert({
      product_id: params.productId,
      seller_id: params.sellerId,
      status: "pending",
      product_ref: productRefFor(params.productId),
      network: CERTIFICATE_NETWORK,
    });
    if (error && !/duplicate key/i.test(error.message)) {
      throw new CertificateError("CERTIFICATE_CREATE_FAILED", error.message);
    }
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select(
      "id, title, description, model, serial_number, production_year, condition, material, country_of_origin, provenance_notes, has_original_box, has_documents, brands(name), categories(slug), product_images(id, storage_path, is_cover, sort_order)",
    )
    .eq("id", params.productId)
    .single();
  if (productError || !product) throw new CertificateError("PRODUCT_NOT_FOUND");

  const images = (product.product_images ?? []) as ProductImageRow[];
  const { hashes, imageUrl } = await snapshotImages(images, params.origin);

  const snapshotAt = new Date().toISOString();
  const manifest = buildManifest({
    product: {
      ...product,
      brandName: product.brands?.name ?? null,
      categorySlug: product.categories?.slug ?? null,
    },
    sellerWallet: params.sellerWallet,
    imageUrl,
    imageHashes: hashes,
    snapshotAt,
  });

  const hash = manifestHash(manifest);
  const metadataPath = `${CERTIFICATE_NETWORK}/${hash.slice(2)}.json`;
  await putOnce(metadataPath, new TextEncoder().encode(canonicalize(manifest)), "application/json");

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("blockchain_certificates")
    .update({
      manifest: manifest as unknown as Json,
      snapshot_at: snapshotAt,
      metadata_hash: hash,
      metadata_uri: publicUrl(params.origin, metadataPath),
      seller_wallet: getAddress(params.sellerWallet),
    })
    .eq("product_id", params.productId)
    .is("manifest", null)
    .select("*")
    .maybeSingle();

  return (updated as CertificateRow | null) ?? (await loadCertificate(params.productId))!;
}

async function markFailed(productId: string, code: string, message: string, retryCount: number) {
  await supabaseAdmin
    .from("blockchain_certificates")
    .update({
      status: "failed",
      last_error_code: code,
      last_error_message: message.slice(0, 500),
      retry_count: retryCount + 1,
    })
    .eq("product_id", productId);
}

/** Reads the chain and writes the result into the database. Never mints. */
export async function reconcileFromChain(row: CertificateRow) {
  const { contract, contractAddress } = getChain();
  const registered: boolean = await contract['isProductRegistered']!(row.product_ref);
  if (!registered) return { reconciled: false as const };

  const tokenId: bigint = await contract['tokenIdOf']!(row.product_ref);
  const record = await contract['getProduct']!(row.product_ref);
  const owner: string = await contract['ownerOf']!(tokenId);

  const update: Record<string, unknown> = {
    status: "minted",
    token_id: tokenId.toString(),
    contract_address: contractAddress,
    current_owner_wallet: getAddress(owner),
    minted_at: new Date(Number(record[2]) * 1000).toISOString(),
    last_error_code: null,
    last_error_message: null,
  };

  if (!row.mint_tx_hash) {
    const logs = await contract
      .queryFilter(contract.filters['ProductRegistered']!(row.product_ref), 0, "latest")
      .catch(() => []);
    const log = logs[0];
    if (log) {
      update['mint_tx_hash'] = log.transactionHash;
      update['mint_block_number'] = log.blockNumber;
    }
  }

  await supabaseAdmin
    .from("blockchain_certificates")
    .update(update)
    .eq("product_id", row.product_id)
    .neq("status", "minted");

  return { reconciled: true as const, tokenId: tokenId.toString() };
}

/**
 * Idempotent mint. Returns the certificate state.
 * A new transaction is only submitted when no previous outcome is unknown.
 */
export async function registerCertificateOnChain(params: {
  productId: string;
  sellerId: string;
  sellerWallet: string;
  origin: string;
}) {
  const { contract, contractAddress, provider } = await preflight();

  const row = await ensureCertificateRow(params);
  if (row.status === "minted") return { status: "minted" as const, tokenId: row.token_id };

  // 1. A known previous submission decides everything.
  if (row.mint_tx_hash) {
    const receipt = await provider.getTransactionReceipt(row.mint_tx_hash).catch(() => null);
    if (!receipt) {
      // Outcome unknown (still pending or dropped): reconcile, never resubmit.
      const result = await reconcileFromChain(row);
      if (result.reconciled) return { status: "minted" as const, tokenId: result.tokenId };
      throw new CertificateError("MINT_PENDING");
    }
    if (receipt.status === 1) {
      const result = await reconcileFromChain(row);
      if (result.reconciled) return { status: "minted" as const, tokenId: result.tokenId };
    }
    // Receipt proven failed → a retry may submit a new transaction below.
  }

  // 2. The chain may already know this product even without a stored tx.
  const already = await reconcileFromChain(row);
  if (already.reconciled) return { status: "minted" as const, tokenId: already.tokenId };

  // 3. Claim the row. Concurrent clicks cannot both proceed.
  const staleBefore = new Date(Date.now() - STALE_MINTING_MS).toISOString();
  const { data: claimed } = await supabaseAdmin
    .from("blockchain_certificates")
    .update({ status: "minting", last_error_code: null, last_error_message: null })
    .eq("product_id", params.productId)
    .or(`status.in.(pending,failed),and(status.eq.minting,updated_at.lt.${staleBefore})`)
    .select("id")
    .maybeSingle();
  if (!claimed) throw new CertificateError("MINT_IN_PROGRESS");

  try {
    const tx = await contract['registerProduct']!(
      row.product_ref,
      getAddress(params.sellerWallet),
      row.metadata_uri,
      row.metadata_hash,
    );

    await supabaseAdmin
      .from("blockchain_certificates")
      .update({ mint_tx_hash: tx.hash, contract_address: contractAddress })
      .eq("product_id", params.productId);

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new CertificateError("MINT_TX_REVERTED");

    const event = receipt.logs
      .map((log: { topics: readonly string[]; data: string }) => {
        try {
          return contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        } catch {
          return null;
        }
      })
      .find((parsed: { name: string } | null) => parsed?.name === "ProductRegistered");
    if (!event) throw new CertificateError("MINT_EVENT_MISSING");

    const tokenId = (event.args['tokenId'] as bigint).toString();
    const owner: string = await contract['ownerOf']!(tokenId);
    if (getAddress(owner) !== getAddress(params.sellerWallet)) {
      throw new CertificateError("MINT_OWNER_MISMATCH");
    }

    await supabaseAdmin
      .from("blockchain_certificates")
      .update({
        status: "minted",
        token_id: tokenId,
        mint_block_number: receipt.blockNumber,
        current_owner_wallet: getAddress(owner),
        contract_address: contractAddress,
        minted_at: new Date().toISOString(),
      })
      .eq("product_id", params.productId);

    return { status: "minted" as const, tokenId };
  } catch (error) {
    const code = error instanceof CertificateError ? error.code : "MINT_FAILED";
    await markFailed(params.productId, code, (error as Error).message ?? code, row.retry_count);
    throw error instanceof CertificateError ? error : new CertificateError("MINT_FAILED");
  }
}

/** Read-only: syncs `current_owner_wallet` from the chain. Nothing else. */
export async function refreshOwnerFromChain(row: CertificateRow) {
  if (row.status !== "minted" || !row.token_id) throw new CertificateError("CERTIFICATE_NOT_MINTED");
  const { contract } = getChain();
  const owner: string = await contract['ownerOf']!(row.token_id);
  const normalized = getAddress(owner);
  if (normalized !== row.current_owner_wallet) {
    await supabaseAdmin
      .from("blockchain_certificates")
      .update({ current_owner_wallet: normalized })
      .eq("product_id", row.product_id);
  }
  return { owner: normalized, changed: normalized !== row.current_owner_wallet };
}

/**
 * Re-canonicalizes and re-hashes the stored immutable manifest, then compares
 * the freshly computed hash with BOTH the stored hash and the contract hash.
 */
export async function verifyIntegrity(row: CertificateRow) {
  if (row.status !== "minted" || !row.token_id) throw new CertificateError("CERTIFICATE_NOT_MINTED");
  if (!row.manifest) throw new CertificateError("MANIFEST_MISSING");

  const computedHash = manifestHash(row.manifest as CertificateManifest);
  const manifestMatchesDatabase = computedHash.toLowerCase() === (row.metadata_hash ?? "").toLowerCase();

  const { contract } = getChain();
  const record = await contract['getProduct']!(row.product_ref);
  const chainHash = String(record[1]).toLowerCase();
  const manifestMatchesChain = computedHash.toLowerCase() === chainHash;

  const owner: string = await contract['ownerOf']!(row.token_id);
  const normalizedOwner = getAddress(owner);
  const ownerChanged = Boolean(
    row.current_owner_wallet && normalizedOwner !== row.current_owner_wallet,
  );

  return {
    computedHash,
    storedHash: row.metadata_hash,
    chainHash,
    manifestMatchesDatabase,
    manifestMatchesChain,
    owner: normalizedOwner,
    ownerChanged,
    verified: manifestMatchesDatabase && manifestMatchesChain,
  };
}

export function assertWallet(address: unknown): string {
  if (typeof address !== "string" || !isAddress(address)) {
    throw new CertificateError("WALLET_REQUIRED");
  }
  return getAddress(address);
}
