import { Link } from "@tanstack/react-router";
import { Gavel, ImageOff, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatAuctionMoney } from "@/lib/auctions";
import { formatCountdown, type AuctionListItem } from "@/lib/public-auctions";

export function AuctionCard({
  auction,
  imageUrl,
  now,
}: {
  auction: AuctionListItem;
  imageUrl?: string | undefined;
  now: number;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("sr") ? "sr-RS" : "en-GB";
  const price = formatAuctionMoney(auction.currentPrice, locale);
  const target = auction.status === "scheduled" ? auction.startsAt : auction.endsAt;
  const countdown = formatCountdown(target, now, t("auctions.card.finished"));

  return (
    <Card interactive className="group h-full overflow-hidden">
      <Link
        to="/auctions/$auctionId"
        params={{ auctionId: auction.id }}
        className="flex h-full flex-col focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label={`${auction.brandName ?? ""} ${auction.title} — ${price}`}
      >
        <div className="surface-gradient relative flex aspect-4/3 items-center justify-center overflow-hidden border-b border-border">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={auction.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <ImageOff className="size-8 text-muted-foreground/50" aria-hidden="true" />
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge
              variant={
                auction.status === "live"
                  ? "live"
                  : auction.status === "scheduled"
                    ? "upcoming"
                    : "outline"
              }
            >
              {t(`auctions.status.${auction.status}`)}
            </Badge>
          </div>
        </div>

        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <p className="eyebrow">{auction.brandName ?? t("products.fields.brandUnknown")}</p>
          <h3 className="font-display text-xl leading-snug transition-colors group-hover:text-primary">
            {auction.title}
          </h3>

          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
            <div>
              <p className="eyebrow">
                {auction.bidCount > 0
                  ? t("auctions.card.currentBid")
                  : t("auctions.card.startingPrice")}
              </p>
              <p className="font-display text-2xl">{price}</p>
            </div>
            <div className="space-y-1 text-right text-xs text-muted-foreground">
              <p className="flex items-center justify-end gap-1.5">
                <Gavel className="size-3.5" aria-hidden="true" />
                {t("auctions.card.bids", { count: auction.bidCount })}
              </p>
              <p className="flex items-center justify-end gap-1.5">
                <Timer className="size-3.5" aria-hidden="true" />
                {auction.status === "scheduled"
                  ? t("auctions.card.startsIn", { value: countdown })
                  : auction.status === "live"
                    ? t("auctions.card.endsIn", { value: countdown })
                    : t("auctions.card.finished")}
              </p>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
