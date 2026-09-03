# On-chain certificate transfer for completed transactions

Connects the existing post-auction confirmation flow to the already deployed Sepolia AuctoryCertificate contract. Nothing in auctions, bidding, finalization, confirmations, disputes, wallet verification or minting is rebuilt or renamed — this only adds the transfer step after `ready_for_transfer`.

## What exists today (verified)

- `transactions` with statuses `awaiting_buyer → awaiting_seller → ready_for_transfer → transferring_certificate → completed`, plus `disputed`. `transferring_certificate` and `completed` are defined but never set by any code yet.
- `blockchain_certificates` holds one minted certificate per product with `product_ref`, `token_id`, `contract_address`, `current_owner_wallet`, immutability triggers.
- The contract exposes `completeSale(saleRef, productRef, buyerWallet, saleDataHash)` (TRANSFER_ROLE only), `getSale`, `isSaleProcessed`, `ownerOf`, and emits `SaleCompleted(saleRef, productRef, tokenId, seller, buyer, saleDataHash, timestamp)`.
- Server-only chain access already lives in `certificates.server.ts` (preflight, provider, operator signer) and is reached through `*.functions.ts` RPCs guarded by `requireSupabaseAuth`.
- There is no `ownership_transfers` table and no notification system in the project.

## What gets built

### 1. Transfer record (new table `ownership_transfers`)
One row per post-auction transaction (unique on `transaction_id`, and unique on `sale_ref`): transaction, auction, product, certificate, token id, `sale_ref`, `sale_data_hash`, previous owner wallet, buyer wallet, status (`pending | submitted | completed | failed`), tx hash, block number, error code/message, retry count, timestamps.

Read access: buyer, seller and admin only. No insert/update/delete grants for authenticated users — every write happens through server-side service-role logic, and an immutability trigger rejects changes to `sale_ref`, `sale_data_hash`, token id, and to the tx hash once completed.

### 2. Canonical sale snapshot
An immutable snapshot is built once and stored on the transfer row: transaction id, auction id, product id and productRef, token id, seller wallet, buyer wallet, final price, currency, final bid-history hash, buyer and seller confirmation timestamps. Serialized with the same documented canonical JSON rules already used for the certificate manifest (lexicographically sorted keys, no insignificant whitespace), hashed with keccak256 → `sale_data_hash`. `saleRef = keccak256(utf8("auctory:sale:<transaction-id>"))`. Retries reuse the stored snapshot byte-for-byte.

The final price is stored as a normalized decimal string (fixed scale, taken from the database numeric, never a JavaScript float) so the hash is deterministic. Wallet addresses in the snapshot are stored in one normalized on-chain form; `previousOwnerWallet` comes from `ownerOf(tokenId)` and must match `blockchain_certificates.current_owner_wallet` before submission.

### 3. Eligibility gate (server-side only)
A transfer starts only when all hold: auction sold with a winner; transaction is `ready_for_transfer`; both confirmations present; no dispute; certificate status `minted`; buyer has a server-verified Sepolia wallet; preflight passes (chain id 11155111, contract bytecode present, not paused, operator holds **TRANSFER_ROLE only** — MINTER_ROLE is not required, configured contract matches the certificate's contract); and `ownerOf(tokenId)` equals the certificate's expected current owner. Every authoritative value — wallets, token id, refs, hashes — is derived server-side from existing rows; the browser sends only a transaction id.

### 4. How a transfer starts
Once a transaction reaches `ready_for_transfer`, both buyer and seller see a "Transfer certificate" action; either may trigger it. In addition, the second confirmation immediately attempts the transfer automatically, with the manual action as a safe fallback if that attempt does not start or fails early. Because starting is guarded by an atomic claim on the transaction and a unique transfer row, refreshing the page, closing the browser or clicking twice can never create a second transfer.

### 5. Transfer execution (atomic state changes)
Two transactional security-definer database functions own all state changes:
- **claim**: in one transaction, move `ready_for_transfer → transferring_certificate` and create-or-claim the `ownership_transfers` row (conditional on the current status, so a concurrent caller gets nothing);
- **finalize**: in one transaction, set `blockchain_certificates.current_owner_wallet`, `ownership_transfers` status/tx hash/block/timestamps, and `transactions.status = completed`. A partial update is impossible — either all three land or none do.

The tx hash is persisted before waiting on the receipt. On success the receipt's `SaleCompleted` event is validated (saleRef, productRef, tokenId, seller, buyer, saleDataHash) and `ownerOf(tokenId)` is re-read and must equal the buyer wallet; only then is finalize called.

Failure handling:
- submission fails before a hash exists → transfer row marked failed and the transaction is released back to `ready_for_transfer` (also in one transactional function), retry allowed;
- a hash exists or the outcome is unknown → stays `transferring_certificate` until reconciliation.

### 6. Idempotency and reconcile/retry
A protected retry action always reconciles first: inspect the saved receipt, `isSaleProcessed(saleRef)`, `getSale(saleRef)`, `ownerOf(tokenId)` and the historical `SaleCompleted` event. If the chain already shows the sale, the database is reconciled to `completed` — no second transaction is sent. While a previous transaction is still pending or its outcome is unknown, the action only reports status; a new submission is allowed **only** after a receipt explicitly shows failure.


### 7. UI and public passport access
- Transaction page: a "Transfer certificate" action for buyer and seller at `ready_for_transfer`, transfer progress (ready → submitting → confirming → completed), previous and new owner, tx hash with Sepolia Etherscan link, block, timestamp, error and retry state, and a retry/reconcile button for participants. The existing outside-payment disclaimer stays exactly as it is.
- `ownership_transfers` stays readable only by buyer, seller and admin. The public `ProductPassport` gets a safe public subset of completed transfer data (previous owner wallet, new owner wallet, tx hash, block, completion timestamp) through a trusted read-only server function limited to products of publicly visible auctions. No internal error text, no private transaction data.
- Both parties see an in-app notice (the existing action-required notice pattern, extended) once the transfer confirms. No email is sent — the project has no email infrastructure.
- All new strings added to EN and SR locale files.

### 7. Tests
Focused unit tests for: canonical snapshot serialization and hash stability, saleRef derivation, eligibility (each failing condition individually: not ready, dispute open, missing buyer wallet, unminted certificate, wrong on-chain owner), duplicate/concurrent claim behaviour, successful transfer path with event validation and final ownership, failed receipt handling, uncertain-transaction reconciliation, and status transitions. Plus a database check that transfer rows are readable only by participants/admin and not directly writable.

## Technical notes

- Migration: `ownership_transfers` (+ enum for its status) with GRANT SELECT to `authenticated`, GRANT ALL to `service_role`, RLS select policy for buyer/seller/admin via the transaction, `updated_at` trigger, immutability trigger, unique constraints on `transaction_id` and `sale_ref`. Same migration adds the transactional security-definer functions `claim_certificate_transfer`, `finalize_certificate_transfer`, `release_certificate_transfer`, and a read-only `public_certificate_transfer(product_id)` for the passport subset.
- New `src/lib/transfers.server.ts` (chain + service-role logic, reusing `getChain`/`preflight`/ABI from the certificate server modules) and `src/lib/transfers.functions.ts` exposing `startCertificateTransfer` and `reconcileCertificateTransfer`, both `requireSupabaseAuth` and validating only a transaction id.
- Sale-snapshot helpers added next to the existing manifest module so canonicalization and keccak256 are shared, not duplicated.
- Client hooks in `src/lib/transfers.ts` following the `certificates.ts` pattern; secrets are read inside handlers only and never logged.
- Verification run at the end: app build plus the blockchain Hardhat test suite; the final report covers migrations, server functions, hashing format, status transitions, idempotency behaviour, test/build results and a manual Sepolia end-to-end checklist.

Out of scope: payments, escrow, user-initiated transfers, automatic authenticity decisions.
