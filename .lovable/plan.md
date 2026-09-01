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

Two protected server functions in `src/lib/wallet.functions.ts` (via `requireSupabaseAuth`, so the acting user comes from the session, never from the client):

- `requestWalletNonce({ address })` — stores a single-use nonce with a short expiry (5 min) for the authenticated user and returns the exact message to sign:
```text
Auctory wallet verification
User: <auth uid>
Address: <checksummed address>
Chain: 11155111 (Sepolia)
Nonce: <nonce>
Expires: <ISO timestamp>
```
- `verifyWalletSignature({ address, signature })` — recovers the signer with `ethers.verifyMessage`, requires an exact match with the address in the nonce row, requires the nonce to be unused and unexpired, marks it used, then writes `wallet_address`, `wallet_network = 'sepolia'`, `wallet_verified_at` to the caller's profile. An unsigned address is never stored.

Uniqueness: a case-insensitive unique index on the stored wallet address means one wallet can be verified by only one user; a second user attempting it gets a clear "wallet already linked to another account" message. Changing the wallet clears `wallet_verified_at` and requires a fresh signature.

New table `wallet_verification_nonces` (user_id, address, nonce, expires_at, used_at). RLS enabled with no direct client access — only the server functions (service role) read and write it. `profiles` keeps its existing policies; wallet columns become writable only through the verification function (a trigger blocks direct client updates to the three wallet columns).

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
