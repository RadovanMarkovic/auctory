# Public auction catalogue, auction page and live bidding

Replace the placeholder auction pages with real data from the backend, add working bidding, and clean up the wording of the auction creation form.

## 1. Catalogue `/auctions`

- Tabs: **Live**, **Upcoming**, **Ended** (Ended is currently not publicly readable — access is extended for it).
- Search over product title, model and brand.
- Filters: category, brand, condition, and a current-price range.
- Current price = highest bid when bids exist, otherwise the start price.
- Sorting: ending soonest for Live/Upcoming, most recently finished for Ended.
- Auction card: cover image, brand + title, current price, bid count, status badge, live countdown.
- Empty, loading and error states reuse the existing shared components; layout and colours stay unchanged.

## 2. Auction page `/auctions/{id}`

- Image gallery of the product (cover first).
- Product details: brand, model, category, condition, material, year, country, box/documents, provenance notes, plus the existing "information provided by the seller, not expert authentication" disclaimer.
- Bidding panel: current price, minimum next bid, countdown, reserve-met indicator (met / not met only — the reserve amount is never shown), anti-sniping notice.
- Bid form for signed-in users. Signed-out visitors see a "Sign in to bid" call to action instead of a redirect. Sellers cannot bid on their own auction.
- Seller summary: display name, country, member since only — served by a restricted public view/function over profiles. No email, phone, or wider profile access.
- Bid history: amount, time and a masked identifier such as `Bidder A7F2`, stable per bidder per auction. Real names, emails and user IDs are never sent to the browser.
- Page metadata (title, description, social preview) generated from the lot.

## 3. Live bidding

- A secure database function places bids and checks: the auction is live, the bidder is not the seller, and the amount is valid — **the first bid must be at least the starting price**, every later bid must be at least highest bid + minimum increment.
- It records the bid, updates highest bid / bid count, and extends the end time when the bid lands inside the anti-sniping window.
- The bid panel refreshes after a bid and polls the public view while an auction is live, so price, countdown and reserve-met stay current without ever fetching the reserve amount.

## 4. Scheduled job

- `pg_cron` calls a secure finalization function inside the database every minute — no application API route, no project key anywhere in the app.
- The job:
  - flips `scheduled` auctions to `live` once they start,
  - flips `live` auctions to `ended` once they finish, setting winner and final price when the reserve was met (or when there is no reserve),
  - leaves reserve-not-met auctions ended with no winner,
  - ignores `cancelled` auctions entirely.

## 4b. Cancelling an auction

- A seller may cancel their own auction while it is `draft`, `scheduled` or `live`, but only while `bid_count = 0`.
- Cancellation runs through secure server-side logic (database function with the same checks), sets the status to `cancelled`, and the cancelled auction disappears from the public catalogue.


## 5. Auction form wording

The form works, but the labels are terse and partly technical. Reword in both English and Serbian:

- "Product" section -> "Choose a lot" with a clearer hint.
- "Pricing" -> "Starting price and bid steps"; "Minimum increment" -> "Minimum bid step (EUR)"; "Start price" -> "Starting price (EUR)"; reserve gets a plain-language explanation of what a reserve does.
- "Schedule" -> "Auction start and end"; "Starts at"/"Ends at" -> "Bidding opens"/"Bidding closes".
- "Anti-sniping (minutes)" -> "Last-minute bid extension" with an explanation in plain language.
- Preview and confirmation copy tightened, currency shown next to amounts.
- Page titles: "New auction" -> "Create an auction", edit page header shows the lot name with a clearer subtitle.

## Technical notes

- Data access: public reads go through the existing `public_auctions` view (which omits `reserve_price`); its read policy is widened to include `ended`, and product/product-image read policies gain the same. Reserve status is exposed only as a boolean.
- Bid history is served by a security-definer function returning amount, timestamp and a masked label derived from a hash of bidder id + auction id — bidder identity never leaves the database.
- `bids` stays insert-locked; all writes go through the bid function, granted to authenticated users only.
- The scheduled job uses `pg_cron` calling a public API route in the app, authenticated with the project key.
- Images use the existing signed-URL helper; the storage bucket already allows read for catalogue images.
- New files: catalogue and detail routes, an `AuctionCard`, a bid panel and bid-history component, and public auction fetchers in `src/lib/auctions.ts`. Translation keys added to both `en.json` and `sr.json`.
