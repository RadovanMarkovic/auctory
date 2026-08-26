import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PublicAuctionRow = Database["public"]["Views"]["public_auctions"]["Row"];

export type AuctionTab = "live" | "upcoming" | "ended";

export const AUCTION_TABS: AuctionTab[] = ["live", "upcoming", "ended"];

export interface AuctionListItem {
  id: string;
  productId: string;
  sellerId: string;
  status: NonNullable<PublicAuctionRow["status"]>;
  currentPrice: number;
  minimumNextBid: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  reserveMet: boolean;
  hasReserve: boolean;
  title: string;
  model: string | null;
  condition: string | null;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  categoryNameEn: string | null;
  categoryNameSr: string | null;
  coverPath: string | null;
}

type ProductJoin = {
  id: string;
  title: string;
  model: string | null;
  condition: string | null;
  brand_id: string | null;
  category_id: string | null;
  brands: { id: string; name: string } | null;
  categories: { id: string; name_en: string; name_sr: string } | null;
  product_images: { storage_path: string; is_cover: boolean; sort_order: number }[];
};

const PRODUCT_SELECT =
  "id, title, model, condition, brand_id, category_id, brands(id, name), categories(id, name_en, name_sr), product_images(storage_path, is_cover, sort_order)";

function coverPath(product: ProductJoin | undefined): string | null {
  if (!product) return null;
  const images = [...(product.product_images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
  return images[0]?.storage_path ?? null;
}

function statusesForTab(tab: AuctionTab) {
  if (tab === "live") return ["live"] as const;
  if (tab === "upcoming") return ["scheduled"] as const;
  return ["ended"] as const;
}

/** Public auctions of one tab, joined with the product data needed by the cards. */
export function usePublicAuctions(tab: AuctionTab) {
  return useQuery({
    queryKey: ["public-auctions", tab],
    refetchInterval: tab === "live" ? 30_000 : false,
    queryFn: async (): Promise<AuctionListItem[]> => {
      const { data: auctions, error } = await supabase
        .from("public_auctions")
        .select("*")
        .in("status", statusesForTab(tab) as unknown as string[])
        .order("ends_at", { ascending: tab !== "ended" })
        .limit(200);
      if (error) throw error;

      const rows = (auctions ?? []).filter((row) => row.id && row.product_id);
      if (rows.length === 0) return [];

      const { data: products, error: productError } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .in("id", Array.from(new Set(rows.map((row) => row.product_id!))));
      if (productError) throw productError;

      const byId = new Map((products ?? []).map((p) => [p.id, p as ProductJoin]));

      return rows.flatMap((row) => {
        const product = byId.get(row.product_id!);
        if (!product) return [];
        return [
          {
            id: row.id!,
            productId: row.product_id!,
            sellerId: row.seller_id!,
            status: row.status!,
            currentPrice: Number(row.current_price ?? row.start_price ?? 0),
            minimumNextBid: Number(row.minimum_next_bid ?? row.start_price ?? 0),
            bidCount: row.bid_count ?? 0,
            startsAt: row.starts_at!,
            endsAt: row.ends_at!,
            reserveMet: Boolean(row.reserve_met),
            hasReserve: Boolean(row.has_reserve),
            title: product.title,
            model: product.model,
            condition: product.condition,
            brandId: product.brand_id,
            brandName: product.brands?.name ?? null,
            categoryId: product.category_id,
            categoryNameEn: product.categories?.name_en ?? null,
            categoryNameSr: product.categories?.name_sr ?? null,
            coverPath: coverPath(product),
          } satisfies AuctionListItem,
        ];
      });
    },
  });
}

export interface AuctionDetail {
  auction: PublicAuctionRow;
  product: Database["public"]["Tables"]["products"]["Row"] & {
    brands: { name: string } | null;
    categories: { name_en: string; name_sr: string } | null;
    product_images: { id: string; storage_path: string; is_cover: boolean; sort_order: number }[];
  };
}

export function usePublicAuction(auctionId: string) {
  return useQuery({
    queryKey: ["public-auction", auctionId],
    refetchInterval: (query) => {
      const status = query.state.data?.auction.status;
      return status === "live" ? 10_000 : status === "scheduled" ? 30_000 : false;
    },
    queryFn: async (): Promise<AuctionDetail | null> => {
      const { data: auction, error } = await supabase
        .from("public_auctions")
        .select("*")
        .eq("id", auctionId)
        .maybeSingle();
      if (error) throw error;
      if (!auction?.product_id) return null;

      const { data: product, error: productError } = await supabase
        .from("products")
        .select(
          "*, brands(name), categories(name_en, name_sr), product_images(id, storage_path, is_cover, sort_order)",
        )
        .eq("id", auction.product_id)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return null;

      return { auction, product } as AuctionDetail;
    },
  });
}

export function useAuctionBidHistory(auctionId: string, enabled = true) {
  return useQuery({
    queryKey: ["auction-bids", auctionId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("auction_bid_history", {
        _auction_id: auctionId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSellerSummary(sellerId: string | null | undefined) {
  return useQuery({
    queryKey: ["seller-summary", sellerId],
    enabled: Boolean(sellerId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_seller_summary", {
        _seller_id: sellerId!,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

/** Ticking clock used by countdowns. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "2d 04h" / "3h 12m" / "08:31" style countdown. */
export function formatCountdown(target: string, now: number, endedLabel: string) {
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return endedLabel;
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}h`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Bid-history error codes raised by the database are mapped to translation keys. */
export function bidErrorKey(message: string): { key: string; min?: string } {
  if (message.includes("BID_TOO_LOW")) {
    const min = message.split("BID_TOO_LOW:")[1]?.trim();
    return { key: "auctions.bid.errors.tooLow", ...(min ? { min } : {}) };
  }
  if (message.includes("SELLER_CANNOT_BID")) return { key: "auctions.bid.errors.ownAuction" };
  if (message.includes("AUCTION_CLOSED")) return { key: "auctions.bid.errors.closed" };
  if (message.includes("AUCTION_NOT_LIVE")) return { key: "auctions.bid.errors.notLive" };
  if (message.includes("AUTH_REQUIRED")) return { key: "auctions.bid.errors.authRequired" };
  return { key: "auctions.bid.errors.generic" };
}
