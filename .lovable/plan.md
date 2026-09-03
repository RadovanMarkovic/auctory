# Product certificates and digital passport (Sepolia)

## What I found first (verified)

- There is **no** `blockchain_certificates` table in the database today, and no certificate columns anywhere. So this step creates it (one certificate per product), rather than extending an existing one.
- The "digital passport" today is only a placeholder card on the public auction page with a short description — no data fields yet. It gets built out for real.
- Wallet verification already exists and is server-verified (nonce + signature, Sepolia only, one wallet per user, profile wallet columns not directly writable). It is reused as-is.
- Product images live in a **private** bucket; there is no public bucket for metadata. A new public, write-once `certificate-metadata` bucket is needed so the token's metadata URI is publicly resolvable.
- Auction eligibility today = own product, status `published`, no active auction, no transaction. A "certificate minted" condition is added for new auctions only.
- The three secrets (`SEPOLIA_RPC_URL`, `OPERATOR_PRIVATE_KEY`, `AUCTORY_CONTRACT_ADDRESS`) already exist and will be read only inside server handlers.

## What gets built

### 1. Certificate record (migration)

New table `public.blockchain_certificates`, one row per product (unique `product_id`), status `pending | minting | minted | failed`, holding: deterministic `product_ref`, metadata manifest (immutable JSONB snapshot), `metadata_uri`, `metadata_hash`, seller wallet, network (`sepolia`), contract address, token id, mint tx hash, block number, current owner wallet, last error code/message, retry count, timestamps.

Access rules in plain language:
- The product's seller and admins can read their certificate; anyone can read certificates of products that are publicly visible through an auction (so the passport works for buyers/visitors).
- Nobody can insert, update or delete certificate rows directly from the app. Only the trusted server flow writes them.
- A guard blocks any change to the manifest, hash, product ref, token id and tx once set.

New storage bucket `certificate-metadata` (public read, no client writes) with content-hash paths — the same content always lands on the same path and an existing object is never overwritten.

### 2. Deterministic manifest and hashing

- `productRef = keccak256(utf8("auctory:product:<product-id>"))`.
- Manifest = snapshot of the final **public** product fields (title, brand, category slug, model, production year, condition, material, country of origin, provenance notes, box/documents flags, seller wallet, product id, schema version, `snapshotAt`) plus `images: [{ index, hash }]` in stable sort order, where each image hash is `keccak256` of the raw file bytes. **keccak256 is used everywhere** — for image bytes and for the canonical manifest; no sha256 anywhere.
- The full serial number is never published: the manifest carries `serialNumberHash = keccak256(normalized serial number)`, or omits the field when the product has none.
- No emails, names, phones or private data.
- Canonical serialization: JSON with keys sorted lexicographically, no insignificant whitespace, UTF-8, numbers as integers/decimal strings. `metadataHash = keccak256(canonicalJSON)`.
- `snapshotAt` is generated **once**, when the certificate row first moves to pending, and the exact stored manifest is reused for every retry. A pending certificate's manifest is never rebuilt from later product edits.
- The public token URI is valid ERC-721 metadata: `name`, `description`, `image`, `attributes`, plus the Auctory manifest fields preserved alongside them (the hashed part is exactly this canonical document).
- Because product images are private, only the final **cover image** is copied server-side into the public certificate bucket at an immutable content-hash path (`sepolia/images/<imageKeccak>.<ext>`); that URL is the `image` field. Public read only, no client writes, no overwrite/upsert.
- Manifest object stored at `sepolia/<metadataHash>.json`; `metadata_uri` is that public URL.


### 3. Minting (server-only)

New `src/lib/certificates.functions.ts` with authenticated server functions; all chain access lives in `src/lib/certificates.server.ts`.

Preflight before any write: chain id must be `11155111`, contract bytecode must exist, contract must not be paused, operator (derived server-side from the private key) must hold `MINTER_ROLE` and `TRANSFER_ROLE`. Any failure returns a typed config error and mints nothing.

Authorization: caller must be signed in, own the product, have the `seller` role, and have a server-verified Sepolia wallet. Drafts stay wallet-free; bidding stays off-chain and untouched.

Flow: claim the row into `minting` with a conditional update (so two concurrent clicks cannot both proceed) → build/store manifest → `registerProduct(productRef, sellerWallet, metadataURI, metadataHash)` with the operator wallet paying gas → persist tx hash immediately → await receipt → require `ProductRegistered` event → verify `ownerOf(tokenId) == sellerWallet` → mark `minted`. Failures set `failed` with an error code and bump retry count.

Idempotency / reconciliation: before minting a retry, check the saved tx receipt, then `isProductRegistered(productRef)` / `tokenIdOf(productRef)` and the `ProductRegistered` log. If the chain already has it, the database is reconciled from on-chain data instead of minting a second time. A stale `minting` row (older than a timeout) is reclaimable only through the same reconciliation path.

A second function refreshes/verifies an existing certificate: recompute nothing, but re-read `ownerOf` and the on-chain record and compare with the stored hash.

### 4. Product and auction lifecycle

- Existing lifecycle untouched; active and completed auctions keep working.
- Seller-only **Register certificate** action on the product edit page (and a status chip in the product list) for eligible products without a minted certificate, with pending/minting/failed/retry states.
- New auctions: `useAuctionableProducts` filters to products with a `minted` certificate, and a database check blocks creating an auction for a product without one. Products already in an auction now are grandfathered.

### 5. Digital passport UI

A `ProductPassport` component used on the public auction detail page (and the seller's product page) showing: network, contract address, token id, metadata hash and URI, mint transaction, block number, registration date, registered seller wallet, current owner wallet, with Sepolia Etherscan links for address/token/tx.

- **Verify record** button: fetches the stored immutable manifest, canonicalizes and keccak256-hashes it again server-side, and compares that freshly computed hash with **both** the stored `metadata_hash` and the contract's `ProductRecord.metadataHash` — never a plain string comparison of two stored values. It also reads current `ownerOf`. Result: "Data integrity verified" or a specific mismatch warning (manifest vs. database, database vs. chain, owner changed).
- Explicit wording: the certificate records data integrity and ownership history; it does **not** independently prove the physical authenticity of the item. Never the phrase "physical authenticity verified".
- A short "Add to MetaMask manually" note with contract address and token id.
- Full EN/SR strings for loading, pending, minting, success, failure, wallet required, wrong network, retry, and verification states.

### 6. Tests

Vitest coverage for: canonical serialization + hash determinism and `productRef` derivation, config validation failures (wrong chain, missing bytecode, paused, missing roles), unauthorized caller / not owner / not seller, missing verified wallet, duplicate concurrent request, successful mint path, failed mint path, receipt and event verification, on-chain reconciliation, and RLS behaviour for certificate rows. Chain calls are mocked; no Sepolia writes in tests. Then run the app build and the existing Hardhat test suite.

## Technical notes

- `ethers` v6 is already a dependency. `blockchain/` is outside the app build graph, so the ABI is not imported from there: the generated ABI is copied **unchanged** into a server-only application module (`src/lib/certificates/abi.server.ts`) so it is guaranteed to be part of the deployed server bundle. A test asserts the copy still matches `blockchain/abi/AuctoryCertificate.json`.
- Secrets are read with `process.env[...]` **inside** handler bodies only, never at module scope, never returned or logged. Only the derived operator *address* may surface in server logs.
- Server-only chain code lives in a `*.server.ts` module imported dynamically inside handlers, so it never reaches the browser bundle.
- Certificate transfer on sale is explicitly **not** part of this step.

## Manual Sepolia checklist (reported at the end)

Verify wallet → register certificate on a published product → watch pending/minted states → open Etherscan links → run Verify record → import token into MetaMask by contract + token id → confirm a second click does not mint twice.
