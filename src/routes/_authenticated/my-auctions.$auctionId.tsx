import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  AuctionForm,
  toAuctionPayload,
  type AuctionFormValues,
} from "@/components/auctions/AuctionForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  formatAuctionMoney,
  isAuctionEditable,
  toLocalInputValue,
  type AuctionStatus,
} from "@/lib/auctions";

const title = "Auction Details — Auctory";
const description = "Review and adjust your scheduled Auctory auction before it goes live.";

export const Route = createFileRoute("/_authenticated/my-auctions/$auctionId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditAuctionPage,
});

function EditAuctionPage() {
  const { auctionId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("sr") ? "sr-RS" : "en-GB";
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const auctionQuery = useQuery({
    queryKey: ["seller-auction", auctionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select("*, products(title, model, brands(name))")
        .eq("id", auctionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const auction = auctionQuery.data ?? null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["seller-auction", auctionId] });
    void queryClient.invalidateQueries({ queryKey: ["my-auctions", user?.id] });
  }

  const saveMutation = useMutation({
    mutationFn: async ({
      values,
      status,
    }: {
      values: AuctionFormValues;
      status: AuctionStatus;
    }) => {
      const payload = toAuctionPayload(values, status);
      if (!payload) throw new Error("invalid");
      const { error } = await supabase.from("auctions").update(payload).eq("id", auctionId);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(
        status === "scheduled" ? t("auctions.form.published") : t("auctions.form.saved"),
      );
      invalidate();
    },
    onError: (_error, variables) =>
      toast.error(
        variables.status === "scheduled"
          ? t("auctions.form.publishFailed")
          : t("auctions.form.saveFailed"),
      ),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_auction", { _auction_id: auctionId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("auctions.manage.cancelled"));
      invalidate();
    },
    onError: () => toast.error(t("auctions.form.saveFailed")),
  });

  if (auctionQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (auctionQuery.isError || !auction) {
    return (
      <PageContainer>
        <ErrorState
          title={t("auctions.detail.notFoundTitle")}
          description={t("auctions.detail.notFoundDescription")}
          onRetry={() => void auctionQuery.refetch()}
        />
      </PageContainer>
    );
  }

  const editable = isAuctionEditable(auction);
  const readOnlyReason =
    auction.bid_count > 0
      ? t("auctions.form.lockedBids")
      : auction.status === "ended" || auction.status === "cancelled"
        ? t("auctions.form.lockedFinished")
        : t("auctions.form.lockedStarted");

  const initialValues: AuctionFormValues = {
    product_id: auction.product_id,
    start_price: String(auction.start_price),
    reserve_price: auction.reserve_price === null ? "" : String(auction.reserve_price),
    minimum_increment: String(auction.minimum_increment),
    starts_at: toLocalInputValue(auction.starts_at),
    ends_at: toLocalInputValue(auction.ends_at),
    anti_sniping_minutes: String(auction.anti_sniping_minutes),
  };

  const productLabel = [auction.products?.brands?.name, auction.products?.title]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("auctions.manage.eyebrow")}
        title={productLabel || t("auctions.manage.title")}
        description={t("auctions.form.editDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{t(`auctions.status.${auction.status}`)}</Badge>
            <Button asChild variant="ghost">
              <Link to="/my-auctions">{t("auctions.manage.backToList")}</Link>
            </Button>
          </div>
        }
      />

      {auction.reserve_price !== null ? (
        <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {t("auctions.reserveSellerOnly", {
            value: formatAuctionMoney(auction.reserve_price, locale),
          })}
        </p>
      ) : null}

      <div className="mt-10">
        <AuctionForm
          key={auction.updated_at}
          initialValues={initialValues}
          submitting={saveMutation.isPending}
          readOnly={!editable}
          readOnlyReason={readOnlyReason}
          lockedProductLabel={productLabel}
          onSubmit={(values, status) => saveMutation.mutate({ values, status })}
          extraActions={
            auction.bid_count === 0 &&
            auction.status !== "ended" &&
            auction.status !== "cancelled" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {t("auctions.manage.cancel")}
              </Button>
            ) : null
          }
        />
      </div>
    </PageContainer>
  );
}
