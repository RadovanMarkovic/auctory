import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatAuctionMoney } from "@/lib/auctions";
import { bidErrorKey } from "@/lib/public-auctions";

export function BidPanel({
  auctionId,
  sellerId,
  minimumNextBid,
  isLive,
  locale,
}: {
  auctionId: string;
  sellerId: string | null;
  minimumNextBid: number;
  isLive: boolean;
  locale: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(minimumNextBid));

  useEffect(() => {
    setAmount(String(minimumNextBid));
  }, [minimumNextBid]);

  const placeBid = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase.rpc("place_bid", {
        _auction_id: auctionId,
        _amount: value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("auctions.bid.success"));
      void queryClient.invalidateQueries({ queryKey: ["public-auction", auctionId] });
      void queryClient.invalidateQueries({ queryKey: ["auction-bids", auctionId] });
      void queryClient.invalidateQueries({ queryKey: ["public-auctions"] });
    },
    onError: (error: Error) => {
      const mapped = bidErrorKey(error.message);
      toast.error(
        t(mapped.key, {
          min: mapped.min ? formatAuctionMoney(Number(mapped.min), locale) : undefined,
        }),
      );
    },
  });

  if (!isLive) {
    return (
      <p className="text-sm text-muted-foreground">{t("auctions.bid.notOpen")}</p>
    );
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("auctions.bid.signInPrompt")}</p>
        <Button asChild variant="gold" className="w-full">
          <Link to="/auth">{t("auctions.bid.signInCta")}</Link>
        </Button>
      </div>
    );
  }

  if (user.id === sellerId) {
    return <p className="text-sm text-muted-foreground">{t("auctions.bid.errors.ownAuction")}</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const value = Number.parseFloat(amount);
        if (!Number.isFinite(value)) {
          toast.error(t("auctions.bid.errors.invalid"));
          return;
        }
        if (value < minimumNextBid) {
          toast.error(
            t("auctions.bid.errors.tooLow", { min: formatAuctionMoney(minimumNextBid, locale) }),
          );
          return;
        }
        placeBid.mutate(value);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="bid-amount">{t("auctions.bid.amountLabel")}</Label>
        <Input
          id="bid-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t("auctions.bid.minimumHint", { value: formatAuctionMoney(minimumNextBid, locale) })}
        </p>
      </div>
      <Button type="submit" variant="gold" className="w-full" disabled={placeBid.isPending}>
        {placeBid.isPending ? t("auctions.bid.submitting") : t("auctions.bid.submit")}
      </Button>
    </form>
  );
}
