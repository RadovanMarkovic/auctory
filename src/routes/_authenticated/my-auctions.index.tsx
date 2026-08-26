import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gavel } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatAuctionDate, formatAuctionMoney } from "@/lib/auctions";
import { useRoles } from "@/lib/use-roles";

const title = "My Auctions — Auctory";
const description = "Create and manage the auctions for your Auctory listings.";

export const Route = createFileRoute("/_authenticated/my-auctions/")({
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
  component: MyAuctionsPage,
});

function MyAuctionsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("sr") ? "sr-RS" : "en-GB";
  const { user } = useAuth();
  const { isSeller, isLoading: rolesLoading } = useRoles();

  const auctionsQuery = useQuery({
    queryKey: ["my-auctions", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auctions")
        .select("*, products(title, brands(name))")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (rolesLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (!isSeller) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow={t("auctions.manage.eyebrow")}
          title={t("auctions.manage.title")}
          description={t("auctions.manage.description")}
        />
        <div className="mt-12">
          <EmptyState
            title={t("products.manage.notSellerTitle")}
            description={t("products.manage.notSellerDescription")}
            action={
              <Button asChild variant="outline">
                <Link to="/profile">{t("seller.become")}</Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    );
  }

  const auctions = auctionsQuery.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("auctions.manage.eyebrow")}
        title={t("auctions.manage.title")}
        description={t("auctions.manage.description")}
        actions={
          <Button asChild>
            <Link to="/my-auctions/new">
              <Gavel />
              {t("auctions.manage.new")}
            </Link>
          </Button>
        }
      />

      <div className="mt-12">
        {auctionsQuery.isLoading ? (
          <LoadingState />
        ) : auctionsQuery.isError ? (
          <ErrorState onRetry={() => void auctionsQuery.refetch()} />
        ) : auctions.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title={t("auctions.manage.emptyTitle")}
            description={t("auctions.manage.emptyDescription")}
          />
        ) : (
          <ul className="space-y-4">
            {auctions.map((auction) => (
              <li key={auction.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="space-y-1">
                      <p className="eyebrow">
                        {auction.products?.brands?.name ?? t("products.fields.brandUnknown")}
                      </p>
                      <p className="font-display text-2xl leading-tight">
                        {auction.products?.title ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("auctions.fields.startPrice")}:{" "}
                        {formatAuctionMoney(auction.start_price, locale)} ·{" "}
                        {t("auctions.fields.endsAt")}:{" "}
                        {formatAuctionDate(auction.ends_at, locale)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline">{t(`auctions.status.${auction.status}`)}</Badge>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/my-auctions/$auctionId" params={{ auctionId: auction.id }}>
                          {t("auctions.manage.open")}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
