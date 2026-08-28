import { createFileRoute, Link } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAuctionDate, formatAuctionMoney } from "@/lib/auctions";
import { useMyTransactions } from "@/lib/transactions";

const title = "My Transactions — Auctory";
const description = "Track post-auction confirmations between buyer and seller on Auctory.";

export const Route = createFileRoute("/_authenticated/transactions/")({
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
  component: TransactionsPage,
});

function TransactionsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("sr") ? "sr-RS" : "en-GB";
  const query = useMyTransactions();
  const rows = query.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("transactions.list.eyebrow")}
        title={t("transactions.list.title")}
        description={t("transactions.list.description")}
      />

      <div className="mt-12">
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={t("transactions.list.emptyTitle")}
            description={t("transactions.list.emptyDescription")}
          />
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => (
              <li key={row.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                    <div className="space-y-1">
                      <p className="eyebrow">
                        {row.products?.brands?.name ?? t("products.fields.brandUnknown")}
                      </p>
                      <p className="font-display text-2xl leading-tight">
                        {row.products?.title ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("transactions.fields.finalPrice")}:{" "}
                        {formatAuctionMoney(row.final_price, locale)} ·{" "}
                        {formatAuctionDate(row.created_at, locale)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline">{t(`transactions.status.${row.status}`)}</Badge>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to="/transactions/$transactionId"
                          params={{ transactionId: row.id }}
                        >
                          {t("transactions.list.open")}
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
