import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";

export type AuctionStatus = Database["public"]["Enums"]["auction_status"];
export type AuctionRow = Database["public"]["Tables"]["auctions"]["Row"];

export const AUCTION_CURRENCY = "EUR";

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

/** An auction can only be edited before it starts and while it has no bids. */
export function isAuctionEditable(auction: Pick<AuctionRow, "status" | "starts_at" | "bid_count">) {
  if (auction.status === "live" || auction.status === "ended" || auction.status === "cancelled") {
    return false;
  }
  if (auction.bid_count > 0) return false;
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

      const blocked = new Set(
        (taken ?? []).map((row) => row.product_id).filter((id) => id !== currentProductId),
      );
      return (products ?? []).filter((product) => !blocked.has(product.id));
    },
  });
}
