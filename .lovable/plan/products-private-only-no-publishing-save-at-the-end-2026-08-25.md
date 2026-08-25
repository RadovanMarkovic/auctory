# Products: private-only, no publishing, save at the end

Products become a private seller workspace. Nothing about products is public — public visibility comes later through auctions.

## Changes

### 1. Save button position (edit + new product page)
- Move the form's Save button so it is the last action on the page, below the images section (and below the provenance attachment).
- On the edit page the form and the image manager become one flow: product fields → provenance → images → Save at the bottom.
- On the new-product page the Save button stays at the bottom as it is (images are added after the first save).

### 2. Remove publishing
- Remove the Publish / Unpublish buttons and the "at least one image required to publish" rule from the edit page.
- Remove the published status from the My Products tabs; keep only Draft and Archived (archive/restore stays).
- Any product created stays private to its owner.

### 3. Remove the public catalogue
- Delete the public catalogue page and the public product detail page.
- Remove the "Products" link from desktop and mobile navigation.
- Remove any links from other pages that point to the public catalogue.
- Remove the now-unused catalogue translation strings.

### 4. Database access rules
- Drop the policy that lets anyone view published products. Only the owning seller (and admins, if that policy exists) can read their own products, their images, and their provenance documents.
- Keep the existing status values in the database so nothing breaks; the app just stops using "published".

## Technical notes
- Files touched: `src/routes/_authenticated/my-products.$productId.tsx`, `src/routes/_authenticated/my-products.index.tsx`, `src/components/products/ProductForm.tsx` (add a slot rendered after the images so Save lands last), `src/config/navigation.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/sr.json`.
- Files removed: `src/routes/products.index.tsx`, `src/routes/products.$productId.tsx`.
- One migration to tighten the products / product_images read policies to owner-only.
