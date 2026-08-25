import { Link } from "@tanstack/react-router";
import { Gavel, ShieldCheck, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, formatTimeLeft } from "@/lib/format";
import type { HomeLot } from "@/mocks/home";

const categoryLabel: Record<HomeLot["category"], string> = {
  watches: "Watches",
  jewelry: "Jewelry",
  collectibles: "Collectibles",
  fashion: "Fashion",
};

export function LotCard({ lot, urgent = false }: { lot: HomeLot; urgent?: boolean }) {
  const timeLeft = formatTimeLeft(lot.endsAt);

  return (
    <Card interactive className="group h-full overflow-hidden">
      <Link
        to="/auctions/$auctionId"
        params={{ auctionId: lot.id }}
        className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${lot.brand} — ${lot.title}, current bid ${formatMoney(lot.currentBid)}`}
      >
        <div
          className="surface-gradient relative flex aspect-4/3 items-center justify-center border-b border-border"
          aria-hidden="true"
        >
          <span className="font-display text-5xl text-muted-foreground/50">
            {lot.brand.charAt(0)}
          </span>
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant={urgent ? "live" : "upcoming"}>
              {urgent ? "Ending soon" : "Live"}
            </Badge>
            {lot.certified ? <Badge variant="gold">Certified</Badge> : null}
          </div>
        </div>

        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <p className="eyebrow">
            {categoryLabel[lot.category]} · {lot.brand}
          </p>
          <h3 className="font-display text-xl leading-snug transition-colors group-hover:text-primary">
            {lot.title}
          </h3>

          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
            <div>
              <p className="eyebrow">Current bid</p>
              <p className="font-display text-2xl">{formatMoney(lot.currentBid)}</p>
            </div>
            <div className="space-y-1 text-right text-xs text-muted-foreground">
              <p className="flex items-center justify-end gap-1.5">
                <Gavel className="size-3.5" aria-hidden="true" />
                {lot.bidCount} bids
              </p>
              <p
                className={`flex items-center justify-end gap-1.5 ${urgent ? "text-destructive" : ""}`}
              >
                <Timer className="size-3.5" aria-hidden="true" />
                {timeLeft}
              </p>
            </div>
          </div>

          {lot.certified ? (
            <p className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
              ERC-721 certificate on settlement
            </p>
          ) : null}
        </CardContent>
      </Link>
    </Card>
  );
}
