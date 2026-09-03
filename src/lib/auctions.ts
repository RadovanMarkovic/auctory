import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";

export type AuctionStatus = Database["public"]["Enums"]["auction_status"];
export type AuctionRow = Database["public"]["Tables"]["auctions"]["Row"];

export const AUCTION_CURRENCY = "EUR";

/**
 * Columns of `auctions` readable through the API. Bidder identity columns
 * (highest_bidder_id, winner_id) are intentionally not selectable, and the
 * reserve price lives in the seller-only `auction_reserves` table.
 */
export const AUCTION_COLUMNS =
  "id, product_id, seller_id, start_price, minimum_increment, starts_at, ends_at, original_ends_at, anti_sniping_minutes, status, highest_bid_amount, bid_count, final_price, created_at, updated_at, finalized_at, has_reserve, reserve_met";

/** Statuses a seller can set from the auction form. */
export const SELLER_AUCTION_STATUSES: AuctionStatus[] = ["draft", "scheduled"];

export function formatAuctionMoney(amount: number | string | null, locale = "en-GB") {
  if (amount === null || amount === "") return "—";
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: AUCTION_CURRENCY,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAuctionDate(value: string | null, locale = "en-GB") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

/** Converts an ISO timestamp into the value shape of <input type="datetime-local">. */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Drafts were never public, so they stay editable (and publishable) at any time.
 * Scheduled auctions lock once they start; bids lock everything.
 */
export function isAuctionEditable(auction: Pick<AuctionRow, "status" | "starts_at" | "bid_count">) {
  if (auction.bid_count > 0) return false;
  if (auction.status === "draft") return true;
  if (auction.status !== "scheduled") return false;
  return new Date(auction.starts_at).getTime() > Date.now();
}

/** Published products of the current seller that have no active auction yet. */
export function useAuctionableProducts(currentProductId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["auctionable-products", userId, currentProductId ?? null],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, title, model, brands(name), product_images(id)")
        .eq("seller_id", userId!)
        .eq("status", "published")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const { data: taken, error: takenError } = await supabase
        .from("auctions")
        .select("product_id, status")
        .eq("seller_id", userId!)
        .in("status", ["draft", "scheduled", "live"]);
      if (takenError) throw takenError;

      // Products from a won auction (a transaction exists) can never be re-listed.
      const { data: sold, error: soldError } = await supabase
        .from("transactions")
        .select("product_id")
        .eq("seller_id", userId!);
      if (soldError) throw soldError;

      // A new auction requires a minted blockchain certificate (enforced in the database too).
      const { data: certificates, error: certificateError } = await supabase
        .from("blockchain_certificates")
        .select("product_id, status")
        .eq("seller_id", userId!)
        .eq("status", "minted");
      if (certificateError) throw certificateError;
      const minted = new Set((certificates ?? []).map((row) => row.product_id));

      const blocked = new Set(
        (taken ?? []).map((row) => row.product_id).filter((id) => id !== currentProductId),
      );
      for (const row of sold ?? []) {
        if (row.product_id !== currentProductId) blocked.add(row.product_id);
      }
      return (products ?? []).filter(
        (product) =>
          !blocked.has(product.id) && (minted.has(product.id) || product.id === currentProductId),
      );

    },
  });
}
