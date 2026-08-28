# Fix: draft auction cannot be published

## What is wrong

Your auction (created 09:55, start time 09:55 today) is saved as `draft`, and its start time is already in the past. The edit page decides whether to show the action buttons using a rule that requires the start time to still be in the future. Since the start time has passed, the whole form switched to read-only and both buttons ("Save draft" and the publish/schedule button) disappeared — with a lock message instead. So there is no way to move the draft to a live auction.

A second, smaller problem: the publish action is labelled "Schedule", which does not read like "publish this auction".

## The fix

1. **Drafts are always editable.** A `draft` auction has never been public, so it can be edited and published at any time, regardless of its start time. Only `scheduled` auctions keep the current rule (locked once the start time passes or once bids exist); `live`, `ended`, `cancelled` and anything with bids stay locked as today.

2. **Publishing with a past start time.** When you publish and the start time is in the past, instead of the current "start must be in the future" error, the auction starts immediately: the start time is set to now and the auction goes live. The confirmation dialog says clearly that it will start immediately. The end time must still be in the future — otherwise an inline error asks you to extend it.

3. **Clearer wording.** The gold button becomes "Publish auction" (SR: "Objavi aukciju"), with a short hint that publishing makes the lot visible in the public catalogue and that it can no longer be edited once bids arrive. The confirmation dialog text is updated to match.

4. **Publish from the list.** On "My Auctions", each `draft` row gets a direct "Publish" button next to "Open", so you do not have to enter the form at all.

## Technical notes

- `isAuctionEditable` in `src/lib/auctions.ts`: return `true` for `status === 'draft'` when `bid_count === 0`; keep the existing start-time check only for `scheduled`.
- `AuctionForm.tsx`: replace the `startInPast` rejection with normalisation of `starts_at` to now on publish; validate `ends_at > now`; relabel the schedule button and confirmation copy.
- `my-auctions.index.tsx`: inline publish mutation for draft rows (same update path as the form, `status: 'scheduled'`).
- Database rules are unchanged: the existing guard trigger already allows draft → scheduled and the finalize job flips it to `live` when the start time is reached (runs every minute), so an immediate start goes live within a minute.
- New EN/SR keys under `auctions.*` for the new labels; no hard-coded strings.
