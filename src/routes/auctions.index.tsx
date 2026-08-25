import { createFileRoute } from "@tanstack/react-router";
import { Gavel } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";

const title = "Live & Upcoming Auctions — Auctory";
const description =
  "Browse Auctory's timed English auctions for luxury watches, jewelry, collectibles, and limited-edition fashion.";

export const Route = createFileRoute("/auctions/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: AuctionsPage,
});

function AuctionsPage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("pages.auctions.eyebrow")}
        title={t("pages.auctions.title")}
        description={t("pages.auctions.description")}
      />
      <div className="mt-12">
        <EmptyState
          icon={Gavel}
          title={t("pages.auctions.emptyTitle")}
          description={t("pages.auctions.emptyDescription")}
        />
      </div>
    </PageContainer>
  );
}
