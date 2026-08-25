import { createFileRoute } from "@tanstack/react-router";
import { PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";

const title = "Sell with Auctory — Consignment & Seller Approval";
const description =
  "Consign luxury watches, jewelry, collectibles, and fashion to Auctory. Every seller and lot is reviewed before going live.";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: SellPage,
});

function SellPage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("pages.sell.eyebrow")}
        title={t("pages.sell.title")}
        description={t("pages.sell.description")}
      />
      <div className="mt-12">
        <EmptyState
          icon={PackageOpen}
          title={t("pages.sell.emptyTitle")}
          description={t("pages.sell.emptyDescription")}
        />
      </div>
    </PageContainer>
  );
}
