import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatAuctionDate, formatAuctionMoney } from "@/lib/auctions";
import { useAuth } from "@/lib/auth-context";

const title = "My Purchases — Auctory";
const description = "Items you have won on Auctory and their blockchain certificates.";

export const Route = createFileRoute("/_authenticated/my-purchases")({
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
  component: MyPurchasesPage,
});

interface PurchaseRow {
  id: string;
  status: string;
  final_price: number;
  updated_at: string;
  auction_id: string;
  product_id: string;
  products: {
    title: string;
    model: string | null;
    brands: { name: string } | null;
    blockchain_certificates: { token_id: string | null; status: string }[] | null;
  } | null;
}

function MyPurchasesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("sr") ? "sr-RS" : "en-GB";
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["my-purchases", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<PurchaseRow[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, status, final_price, updated_at, auction_id, product_id, products(title, model, brands(name), blockchain_certificates(token_id, status))",
        )
        .eq("buyer_id", user!.id)
        .in("status", ["ready_for_transfer", "transferring_certificate", "completed"])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseRow[];
    },
  });

  const rows = query.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("purchases.eyebrow")}
        title={t("purchases.title")}
        description={t("purchases.description")}
      />

      <div className="mt-12">
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t("purchases.emptyTitle")}
            description={t("purchases.emptyDescription")}
            action={
              <Button asChild variant="outline">
                <Link to="/auctions">{t("nav.liveAuctions")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => {
              const certificate = row.products?.blockchain_certificates?.[0] ?? null;
              const owned = row.status === "completed";
              return (
                <li key={row.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                      <div className="space-y-1">
                        <p className="eyebrow">
                          {row.products?.brands?.name ?? t("products.fields.brandUnknown")}
                        </p>
                        <p className="font-display text-2xl leading-tight">
                          {row.products?.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("purchases.price")}: {formatAuctionMoney(row.final_price, locale)} ·{" "}
                          {t("purchases.purchasedOn")}: {formatAuctionDate(row.updated_at, locale)}
                          {certificate?.token_id
                            ? ` · ${t("purchases.tokenId")}: ${certificate.token_id}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant={owned ? "default" : "outline"}>
                          {owned ? t("purchases.owned") : t("purchases.pending")}
                        </Badge>
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to="/transactions/$transactionId"
                            params={{ transactionId: row.id }}
                          >
                            {t("purchases.viewTransaction")}
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/auctions/$auctionId" params={{ auctionId: row.auction_id }}>
                            {t("purchases.viewPassport")}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
