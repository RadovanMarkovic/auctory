import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  AuctionForm,
  emptyAuctionForm,
  toAuctionPayload,
  toReservePrice,
  type AuctionFormValues,
} from "@/components/auctions/AuctionForm";
import { WalletRequiredNotice } from "@/components/wallet/WalletRequiredNotice";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { AuctionStatus } from "@/lib/auctions";
import { useRoles } from "@/lib/use-roles";
import { useWallet } from "@/lib/wallet/use-wallet";
import { isConnectedVerifiedWallet, useVerifiedWallet } from "@/lib/wallet/verify";

const title = "New Auction — Auctory";
const description = "Schedule a timed English auction for one of your published Auctory products.";

export const Route = createFileRoute("/_authenticated/my-auctions/new")({
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
  component: NewAuctionPage,
});

function NewAuctionPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSeller, isLoading } = useRoles();
  const wallet = useWallet();
  const verifiedWallet = useVerifiedWallet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async ({
      values,
      status,
    }: {
      values: AuctionFormValues;
      status: AuctionStatus;
    }) => {
      if (
        status === "scheduled" &&
        !isConnectedVerifiedWallet(verifiedWallet.data, wallet.address, wallet.onSepolia)
      ) {
        throw new Error("WALLET_CONNECTION_REQUIRED");
      }
      const payload = toAuctionPayload(values, status);
      if (!payload) throw new Error("invalid");
      const { data, error } = await supabase
        .from("auctions")
        .insert({ ...payload, seller_id: user!.id })
        .select("id")
        .single();
      if (error) throw error;

      const reservePrice = toReservePrice(values);
      if (reservePrice !== null) {
        const { error: reserveError } = await supabase
          .from("auction_reserves")
          .upsert({ auction_id: data.id, reserve_price: reservePrice });
        if (reserveError) throw reserveError;
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success(t("auctions.form.created"));
      void queryClient.invalidateQueries({ queryKey: ["my-auctions", user?.id] });
      void navigate({ to: "/my-auctions/$auctionId", params: { auctionId: data.id } });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error &&
          /wallet_not_verified|WALLET_CONNECTION_REQUIRED/i.test(error.message)
          ? t("wallet.required.seller")
          : t("auctions.form.saveFailed"),
      ),
  });

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (!isSeller) {
    return (
      <PageContainer>
        <EmptyState
          title={t("products.manage.notSellerTitle")}
          description={t("products.manage.notSellerDescription")}
          action={
            <Button asChild variant="outline">
              <Link to="/profile">{t("seller.become")}</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("auctions.manage.eyebrow")}
        title={t("auctions.form.newTitle")}
        description={t("auctions.form.newDescription")}
        actions={
          <Button asChild variant="ghost">
            <Link to="/my-auctions">{t("auctions.manage.backToList")}</Link>
          </Button>
        }
      />

      <div className="mt-10 space-y-6">
        <WalletRequiredNotice context="seller" />
        <AuctionForm
          initialValues={emptyAuctionForm}
          submitting={createMutation.isPending}
          onBeforePublish={() => {
            const ready = isConnectedVerifiedWallet(
              verifiedWallet.data,
              wallet.address,
              wallet.onSepolia,
            );
            if (!ready) toast.error(t("wallet.required.connectedSeller"));
            return ready;
          }}
          onSubmit={(values, status) => createMutation.mutate({ values, status })}
        />
      </div>
    </PageContainer>
  );
}
