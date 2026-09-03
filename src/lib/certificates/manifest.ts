/**
 * Deterministic certificate manifest + hashing.
 *
 * Pure and dependency-light (ethers keccak256 only): no I/O, no secrets.
 * keccak256 is used EVERYWHERE — image bytes, serial number, canonical manifest.
 */

import { getAddress, keccak256, toUtf8Bytes } from "ethers";

export const MANIFEST_SCHEMA_VERSION = 1;
export const CERTIFICATE_NETWORK = "sepolia";

export interface ManifestImage {
  index: number;
  hash: string;
}

export interface ManifestAttribute {
  trait_type: string;
  value: string | number;
}

/** ERC-721 metadata document with the Auctory manifest preserved under `auctory`. */
export interface CertificateManifest {
  name: string;
  description: string;
  image: string;
  attributes: ManifestAttribute[];
  auctory: {
    schemaVersion: number;
    productId: string;
    productRef: string;
    network: string;
    sellerWallet: string;
    snapshotAt: string;
    images: ManifestImage[];
    serialNumberHash?: string;
  };
}

/** keccak256 of the UTF-8 bytes of `auctory:product:<product-id>`. */
export function productRefFor(productId: string): string {
  return keccak256(toUtf8Bytes(`auctory:product:${productId}`));
}

/** keccak256 of the normalized (trimmed, uppercased, whitespace-collapsed) serial. */
export function serialNumberHash(serial: string): string {
  const normalized = serial.trim().replace(/\s+/g, " ").toUpperCase();
  return keccak256(toUtf8Bytes(normalized));
}

export function hashBytes(bytes: Uint8Array): string {
  return keccak256(bytes);
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Recursively sorts object keys; arrays keep their order. */
function canonicalValue(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, Json> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      out[key] = canonicalValue(source[key]);
    }
    return out;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("MANIFEST_INVALID_NUMBER");
    return value;
  }
  return value as Json;
}

/** Canonical JSON: lexicographically sorted keys, no insignificant whitespace, UTF-8. */
export function canonicalize(manifest: unknown): string {
  return JSON.stringify(canonicalValue(manifest));
}

/** keccak256 of the canonical JSON document. */
export function manifestHash(manifest: unknown): string {
  return keccak256(toUtf8Bytes(canonicalize(manifest)));
}

export interface ManifestProductInput {
  id: string;
  title: string;
  description?: string | null;
  model?: string | null;
  serial_number?: string | null;
  production_year?: number | null;
  condition?: string | null;
  material?: string | null;
  country_of_origin?: string | null;
  provenance_notes?: string | null;
  has_original_box: boolean;
  has_documents: boolean;
  brandName?: string | null;
  categorySlug?: string | null;
}

export interface BuildManifestInput {
  product: ManifestProductInput;
  sellerWallet: string;
  /** Public, immutable URL of the cover image copy. */
  imageUrl: string;
  /** keccak256 of every image's raw bytes, in stable order. */
  imageHashes: string[];
  /** Generated exactly once, when the certificate row first becomes pending. */
  snapshotAt: string;
}

function attribute(trait: string, value: unknown): ManifestAttribute | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return { trait_type: trait, value: value ? "yes" : "no" };
  if (typeof value === "number") return { trait_type: trait, value };
  return { trait_type: trait, value: String(value) };
}

/** Builds the immutable public manifest. Never includes private data. */
export function buildManifest({
  product,
  sellerWallet,
  imageUrl,
  imageHashes,
  snapshotAt,
}: BuildManifestInput): CertificateManifest {
  const attributes = [
    attribute("Brand", product.brandName),
    attribute("Category", product.categorySlug),
    attribute("Model", product.model),
    attribute("Production year", product.production_year),
    attribute("Condition", product.condition),
    attribute("Material", product.material),
    attribute("Country of origin", product.country_of_origin),
    attribute("Original box", product.has_original_box),
    attribute("Documents", product.has_documents),
    attribute("Provenance notes", product.provenance_notes),
  ].filter((entry): entry is ManifestAttribute => entry !== null);

  const manifest: CertificateManifest = {
    name: product.title,
    description:
      product.description?.trim() ||
      `Auctory data-integrity certificate for ${product.title}. Records the listing data as submitted by the seller; it does not independently prove the physical authenticity of the item.`,
    image: imageUrl,
    attributes,
    auctory: {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      productId: product.id,
      productRef: productRefFor(product.id),
      network: CERTIFICATE_NETWORK,
      sellerWallet: getAddress(sellerWallet),
      snapshotAt,
      images: imageHashes.map((hash, index) => ({ index, hash })),
    },
  };

  if (product.serial_number && product.serial_number.trim()) {
    manifest.auctory.serialNumberHash = serialNumberHash(product.serial_number);
  }

  return manifest;
}
