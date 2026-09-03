import { readFileSync } from "node:fs";

import { keccak256, toUtf8Bytes } from "ethers";
import { describe, expect, it } from "vitest";

import { AUCTORY_CERTIFICATE_ABI } from "./abi.server";
import {
  buildManifest,
  canonicalize,
  hashBytes,
  manifestHash,
  productRefFor,
  serialNumberHash,
  type ManifestProductInput,
} from "./manifest";

const SELLER = "0x1111111111111111111111111111111111111111";

const product: ManifestProductInput = {
  id: "3f6bfe0e-9d3a-4a05-9a4c-6a24b7ce6f11",
  title: "Rolex Submariner",
  description: "Full set, 2019.",
  model: "126610LN",
  serial_number: " ab-12 34 ",
  production_year: 2019,
  condition: "excellent",
  material: "Steel",
  country_of_origin: "CH",
  provenance_notes: "Single owner",
  has_original_box: true,
  has_documents: false,
  brandName: "Rolex",
  categorySlug: "watches",
};

function manifest(overrides: Partial<Parameters<typeof buildManifest>[0]> = {}) {
  return buildManifest({
    product,
    sellerWallet: SELLER,
    imageUrl: "https://example.test/api/public/certificates/sepolia/images/aa.jpg",
    imageHashes: [keccak256(toUtf8Bytes("a")), keccak256(toUtf8Bytes("b"))],
    snapshotAt: "2026-09-03T10:00:00.000Z",
    ...overrides,
  });
}

describe("productRef", () => {
  it("is keccak256 of the namespaced product id", () => {
    expect(productRefFor(product.id)).toBe(keccak256(toUtf8Bytes(`auctory:product:${product.id}`)));
  });

  it("differs per product", () => {
    expect(productRefFor("a")).not.toBe(productRefFor("b"));
  });
});

describe("canonical serialization", () => {
  it("sorts keys lexicographically at every level and drops whitespace", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}',
    );
  });

  it("is stable regardless of key insertion order", () => {
    const one = manifest();
    const two = { ...manifest() };
    expect(manifestHash(one)).toBe(manifestHash(two));
    expect(manifestHash({ ...two, name: "Other" })).not.toBe(manifestHash(one));
  });

  it("hashes with keccak256 over the canonical UTF-8 document", () => {
    const value = manifest();
    expect(manifestHash(value)).toBe(keccak256(toUtf8Bytes(canonicalize(value))));
  });
});

describe("manifest contents", () => {
  it("is valid ERC-721 metadata and keeps the Auctory fields", () => {
    const value = manifest();
    expect(value.name).toBe("Rolex Submariner");
    expect(value.description.length).toBeGreaterThan(0);
    expect(value.image).toMatch(/^https:\/\//);
    expect(value.attributes.length).toBeGreaterThan(0);
    expect(value.auctory.productRef).toBe(productRefFor(product.id));
    expect(value.auctory.images).toEqual([
      { index: 0, hash: keccak256(toUtf8Bytes("a")) },
      { index: 1, hash: keccak256(toUtf8Bytes("b")) },
    ]);
  });

  it("never publishes the raw serial number, only its keccak256 hash", () => {
    const value = manifest();
    const json = canonicalize(value);
    expect(json).not.toContain("ab-12 34");
    expect(json).not.toContain("AB-12 34");
    expect(value.auctory.serialNumberHash).toBe(keccak256(toUtf8Bytes("AB-12 34")));
    expect(serialNumberHash("  ab-12   34 ")).toBe(value.auctory.serialNumberHash);
  });

  it("omits the serial hash when the product has none", () => {
    const value = buildManifest({
      product: { ...product, serial_number: null },
      sellerWallet: SELLER,
      imageUrl: "https://example.test/x.jpg",
      imageHashes: [],
      snapshotAt: "2026-09-03T10:00:00.000Z",
    });
    expect(value.auctory.serialNumberHash).toBeUndefined();
  });

  it("contains no private data", () => {
    const json = canonicalize(manifest());
    for (const forbidden of ["@", "phone", "email", "seller_id"]) {
      expect(json.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("keeps the snapshot time exactly as supplied (never regenerated)", () => {
    expect(manifest().auctory.snapshotAt).toBe("2026-09-03T10:00:00.000Z");
    expect(manifestHash(manifest())).toBe(manifestHash(manifest()));
    expect(manifestHash(manifest({ snapshotAt: "2026-09-04T10:00:00.000Z" }))).not.toBe(
      manifestHash(manifest()),
    );
  });
});

describe("image hashing", () => {
  it("hashes raw bytes with keccak256", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(hashBytes(bytes)).toBe(keccak256(bytes));
  });
});

describe("ABI copy", () => {
  it("matches the exported Hardhat ABI byte-for-byte in structure", () => {
    const source = JSON.parse(readFileSync("blockchain/abi/AuctoryCertificate.json", "utf8"));
    expect(JSON.parse(JSON.stringify(AUCTORY_CERTIFICATE_ABI))).toEqual(source.abi);
  });

  it("exposes the functions and events the mint flow relies on", () => {
    const names = new Set(
      AUCTORY_CERTIFICATE_ABI.map((entry) => ("name" in entry ? entry.name : "")),
    );
    for (const required of [
      "registerProduct",
      "isProductRegistered",
      "tokenIdOf",
      "getProduct",
      "ownerOf",
      "paused",
      "hasRole",
      "MINTER_ROLE",
      "TRANSFER_ROLE",
      "ProductRegistered",
    ]) {
      expect(names).toContain(required);
    }
  });
});
