import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { usePublicAuctions, type AuctionListItem } from "@/lib/public-auctions";

export interface HomeStats {
  lotsSold: number;
  certificatesMinted: number;
  sellThrough: number;
  bidsPlaced: number;
}

/** Aggregated public numbers for the home page (no private data involved). */
export function useHomeStats() {
  return useQuery({
    queryKey: ["home-stats"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<HomeStats> => {
      const [{ data: ended, error: endedError }, { count: minted, error: mintedError }] =
        await Promise.all([
          supabase.from("public_auctions").select("final_price, bid_count").limit(1000),
          supabase
            .from("blockchain_certificates")
            .select("id", { count: "exact", head: true })
            .eq("status", "minted"),
        ]);
      if (endedError) throw endedError;
      if (mintedError) throw mintedError;

      const rows = ended ?? [];
      const bidsPlaced = rows.reduce((total, row) => total + (row.bid_count ?? 0), 0);
      const sold = rows.filter((row) => row.final_price !== null).length;
      const finished = rows.filter(
        (row) => row.final_price !== null || row.bid_count !== null,
      ).length;

      return {
        lotsSold: sold,
        certificatesMinted: minted ?? 0,
        sellThrough: finished > 0 ? Math.round((sold / finished) * 100) : 0,
        bidsPlaced,
      };
    },
  });
}

/** Live + upcoming auctions shaped into the sections the home page renders. */
export function useHomeHighlights() {
  const live = usePublicAuctions("live");
  const upcoming = usePublicAuctions("upcoming");

  const featured = useMemo<AuctionListItem[]>(() => {
    const source = (live.data ?? []).length > 0 ? (live.data ?? []) : (upcoming.data ?? []);
    return [...source]
      .sort((a, b) => b.bidCount - a.bidCount || b.currentPrice - a.currentPrice)
      .slice(0, 3);
  }, [live.data, upcoming.data]);

  const endingSoon = useMemo<AuctionListItem[]>(
    () =>
      [...(live.data ?? [])]
        .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
        .slice(0, 3),
    [live.data],
  );

  const openAuctions = useMemo<AuctionListItem[]>(
    () => [...(live.data ?? []), ...(upcoming.data ?? [])],
    [live.data, upcoming.data],
  );

  return {
    featured,
    endingSoon,
    openAuctions,
    isPending: live.isPending || upcoming.isPending,
    isError: live.isError || upcoming.isError,
    refetch: () => {
      void live.refetch();
      void upcoming.refetch();
    },
  };
}
