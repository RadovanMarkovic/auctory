import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";

const title = "Your Account — Auctory";
const description = "Manage your Auctory bids, listings, orders, and wallet connection.";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("pages.account.eyebrow")}
        title={t("pages.account.title")}
        description={t("pages.account.description")}
      />
      <div className="mt-12">
        <EmptyState
          icon={UserRound}
          title={t("pages.account.emptyTitle")}
          description={t("pages.account.emptyDescription")}
        />
      </div>
    </PageContainer>
  );
}
