# MetaMask wallet connection and server-verified ownership (Sepolia)

Yes — clear, and it fits the current code. Today `profiles` already has `wallet_address`, `wallet_verified_at`, `wallet_network`, the Profile page shows a read-only "coming soon" wallet card, and `WalletButton` is a disabled placeholder. Nothing about bidding, finalization, confirmations, or status lifecycles changes.

## 1. Wallet connection layer (frontend)

New `src/lib/wallet/` module using `ethers` v6, browser-only (loaded after hydration so SSR is unaffected):
- connect via `eth_requestAccounts`, read the current chain, and expose a `useWallet()` context with `status`, `address`, `chainId`.
- logical disconnect: clear local wallet state only (MetaMask has no real disconnect); verified wallet in the database is untouched.
- listeners for `accountsChanged` and `chainChanged`, with state reset on account switch.
- wrong network: prompt `wallet_switchEthereumChain` to Sepolia (`0xaa36a7`), and `wallet_addEthereumChain` when the chain is unknown.
- distinct handled errors with EN/SR messages: MetaMask not installed, user rejected (4001), request already pending (-32002), wrong network, unsupported browser.

Private keys are never touched — only `personal_sign` through the provider.

## 2. Server-verified ownership

Two protected server functions in `src/lib/wallet.functions.ts` (via `requireSupabaseAuth`, so the acting user comes from the session, never from the client). This stack does guarantee server-only execution: the build strips `.handler()` bodies from client bundles, and all privileged logic (nonce writes, signature recovery, profile updates) lives in the handler body or in a `wallet.server.ts` helper that is blocked from client bundles by filename. No Edge Function fallback is needed, and nothing secret sits at module scope.

- `requestWalletNonce({ address })` — normalizes/checksums the address, stores a single-use nonce bound to the authenticated user and that address, expiring in 5 minutes, and returns the exact message to sign:
```text
Auctory wallet verification
Domain: <application origin>
User: <auth uid>
Address: <checksummed address>
Chain: 11155111 (Sepolia)
Nonce: <nonce>
Expires: <ISO timestamp>
```
- `verifyWalletSignature({ address, signature })` — rebuilds the exact message from the stored nonce row, recovers the signer with `ethers.verifyMessage`, and requires an exact match with the bound address, the caller's user ID, and an unexpired, unused nonce. The nonce is consumed conditionally (`UPDATE ... WHERE used_at IS NULL AND expires_at > now() RETURNING`), so two simultaneous attempts cannot both succeed. Only after that does it write `wallet_address`, `wallet_network = 'sepolia'`, `wallet_verified_at`. An unsigned address is never stored.

Uniqueness: a unique index on the normalized (lower-cased) wallet address enforces at the database level that one address belongs to at most one Auctory user; a second user attempting it gets a clear "wallet already linked to another account" message. Changing the wallet clears `wallet_verified_at` and requires a fresh signature.

New table `wallet_verification_nonces` (user_id, address, nonce, expires_at, used_at) with RLS enabled and no client grants at all — only the server-side verification flow (service role) reads and writes it.

`profiles` keeps its existing policies, but a `BEFORE UPDATE` trigger rejects any change to `wallet_address`, `wallet_verified_at`, or `wallet_network` unless it comes from the verification flow (a server-side marker the client cannot set). Authenticated users therefore cannot forge wallet verification through a direct profile update.


## 3. Where a wallet is required

- Product draft: no wallet needed (unchanged).
- Publishing a product: an approved seller must have a verified Sepolia wallet. Enforced in the database (trigger on the draft → published transition) and mirrored in the UI, where the publish buttons in `my-products.index.tsx` and `my-products.$productId.tsx` show a "verify your wallet first" notice with a link to the account wallet section.
- Bidding: no wallet required (unchanged).
- Buyer: prompted to verify a wallet only once a transaction reaches `ready_for_transfer`, shown on the transaction page and in the existing `ActionRequiredNotice`.

Certificate minting is not implemented in this step; the wallet gate is the prerequisite it will later use.

## 4. UI

- Profile wallet card becomes functional: connect, verify (sign), change wallet, disconnect, plus verified address, network, and verification date.
- `WalletButton` in the header/mobile nav becomes active: connect / wrong-network / connected states.
- Transaction page gains the buyer wallet prompt at `ready_for_transfer`.
- All strings added under existing `wallet.*` and `profile.wallet.*` keys in EN and SR. No design-system or layout changes.

## 5. Technical notes

- Adds `ethers@^6` as the only new dependency; imported dynamically in browser-only code paths.
- Migration: `wallet_verification_nonces` table with GRANTs and RLS, unique lower-case index on `profiles.wallet_address`, trigger guarding direct wallet-column writes, and a publish guard requiring `wallet_verified_at` with `wallet_network = 'sepolia'` for seller publishing.
- No Sepolia contract calls, no minting, no private keys, no changes to bidding, `finalize_auctions`, confirmations, or any status enum.
