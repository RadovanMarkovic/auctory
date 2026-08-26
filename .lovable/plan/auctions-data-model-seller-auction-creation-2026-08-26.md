# Auctions: data model + seller auction creation

Reuse the existing product, role, RLS and i18n structure. No changes to product status values (`draft`, `published`, `archived`) — publishing is simply re-enabled in the UI as the gate for auctioning.

## What gets built

### 1. Re-enable product publishing (prerequisite)
- Product form / My Products regains a "Publish" action: a product with at least one image can move `draft -> published`. Archive stays as-is.
- Published products remain private to the seller until an auction makes them visible.

### 2. Auctions and bids tables
`auctions`: product_id, seller_id, start_price, reserve_price (optional), minimum_increment, starts_at, ends_at, original_ends_at, anti_sniping_minutes, status, highest_bid_amount, highest_bidder_id, bid_count, winner_id, final_price, created_at, updated_at, finalized_at.

Statuses: `draft`, `scheduled`, `live`, `ended`, `cancelled`.

`bids`: auction_id, bidder_id, amount, created_at. (Table created now; bidding UI comes in a later step.)

Rules enforced in the database:
- Only a user with the `seller` role can create an auction, and only for their own `published` product.
- A product can have at most one auction that is not `ended`/`cancelled` (partial unique index).
- Prices positive, reserve >= start price, increment > 0, ends_at > starts_at.
- Edits allowed only while status is `draft`/`scheduled`, the start time has not passed, and `bid_count = 0`.

### 3. Access rules
- Seller: full read/manage of their own auctions.
- Everyone (including signed-out visitors): read access to `scheduled` and `live` auctions, plus the product info and images needed to display them.
- `reserve_price` is never exposed publicly — public reads go through a view/column set that omits it; the seller sees it on their own auction.
- Admin: read all.

### 4. Seller auction form
New route `/my-auctions` (list) and `/my-auctions/new` + `/my-auctions/:id` (create/edit), under the authenticated area, seller-only:
- Product selector (only own published products without an active auction)
- Start price, optional reserve price, minimum increment
- Start and end date/time pickers
- Anti-sniping duration in minutes (default 5)
- Preview step showing exactly what bidders will see (reserve hidden), then a confirmation dialog to schedule
- Save as draft, or schedule; editing blocked once started or once bids exist (form becomes read-only with an explanation)
- Client-side validation mirroring the database rules, with inline errors

### 5. Translations
All new strings added to `en.json` and `sr.json` under an `auctions.*` namespace. No hard-coded UI text.

## Technical notes
- Timestamps stored as `timestamptz`; money as `numeric(12,2)` in EUR.
- `anti_sniping_minutes` is stored now; the extension logic (`original_ends_at` vs `ends_at`) runs when bidding is implemented.
- Status transitions live/ended will be driven by a scheduled job in the bidding step; this step only allows draft/scheduled/cancelled from the UI.
- `has_role()` and existing RLS conventions (GRANTs per table, owner-scoped policies plus narrow anon read) are reused unchanged.

## Not in this step
Bidding UI, anti-sniping execution, auction finalization, payments, certificates, public auction browsing polish beyond basic read access.
