import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { EmptyState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";

const title = "Lot Details — Auctory";
const description = "Lot details, bidding history, and certificate provenance on Auctory.";

export const Route = createFileRoute("/auctions/$auctionId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AuctionDetailPage,
});

function AuctionDetailPage() {
  const { auctionId } = Route.useParams();
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("pages.lot.eyebrow", { id: auctionId })}
        title={t("pages.lot.title")}
        description={t("pages.lot.description")}
      />
      <div className="mt-12">
        <EmptyState
          title={t("pages.lot.emptyTitle")}
          description={t("pages.lot.emptyDescription")}
        />
      </div>
    </PageContainer>
  );
}
