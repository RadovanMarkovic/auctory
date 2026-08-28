# Post-auction transactions (confirmations only, no payments)

Yes — the idea is clear: after an auction ends with a valid winner, Auctory only records two separate confirmations (buyer and seller) with timestamps. Payment and delivery happen entirely outside the platform.

## What gets built

### 1. Transactions record
A new `transactions` table, one row per auction at most, holding: auction, product, seller, winner, final price, a hash of the final bid history, status, buyer confirmation (who + when), seller confirmation (who + when), and optional dispute reason/opened-by/opened-at.

Statuses: `awaiting_buyer`, `awaiting_seller`, `ready_for_transfer`, `disputed`, `transferring_certificate`, `completed`.

### 2. Finalization extension (no rebuild)
The existing scheduled finalization function is extended, not replaced. When it marks an auction ended:
- a transaction is created only if there is a winner and either no reserve or the reserve was met;
- auctions with no bids or below reserve stay ended with no winner and no transaction;
- creation is idempotent — the unique link to the auction means repeated runs never duplicate or alter an existing transaction.

Auction statuses and lifecycle stay exactly as they are.

### 3. Transaction page
New route `/transactions/$transactionId`, plus a `/transactions` list of the user's transactions. The page shows:
- auction result and final price, with product summary;
- a clear disclaimer that payment and delivery are arranged outside Auctory, and that Auctory is not a payment provider or escrow — no card, bank, or payment instruction fields anywhere;
- a confirmation timeline (auction ended → buyer confirmation → seller confirmation → ready for transfer, plus dispute if opened);
- separate buyer and seller confirmation buttons, each opening a dialog with a required acknowledgement checkbox (buyer: payment arranged/completed outside the platform; seller: payment received and product handed over/shipped);
- a dispute button for either party, requiring a reason, available before certificate transfer.

Either party may confirm first. A second click by the same party changes nothing. Once both confirmations exist the status becomes `ready_for_transfer`.

### 4. "Action required" notice
Buyers and sellers with a transaction that still needs their confirmation see an in-app notice (header/account area and the My Auctions view) linking straight to that transaction page.

### 5. Access control
Only the buyer, seller, and admin can see or act on a transaction. Confirmations and disputes go through secure database functions that derive the acting user server-side, so neither party can confirm on the other's behalf.

## Out of scope for this step
Payment processing, dispute resolution workflow, MetaMask, and certificate transfer on-chain. The `transferring_certificate` and `completed` statuses exist in the model but are not driven by any UI yet.

## Technical notes
- Migration: `transactions` table with `UNIQUE (auction_id)`, FK to auctions/products, GRANTs for `authenticated` and `service_role`, RLS restricting rows to buyer/seller/admin, `updated_at` trigger.
- `finalize_auctions()` gets an `INSERT ... SELECT ... ON CONFLICT (auction_id) DO NOTHING` step for newly ended, winner-bearing auctions; bid-history hash computed from that auction's bid rows.
- New security-definer functions: `confirm_transaction_buyer`, `confirm_transaction_seller`, `open_transaction_dispute`; all use `auth.uid()`, are no-ops on duplicate confirmation, and recompute status.
- Frontend: `src/lib/transactions.ts` (queries/mutations), reusing existing `ConfirmationDialog`, `PageHeader`, empty/loading/error states; EN/SR keys added under `transactions.*`. No design-system changes.
