import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";

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
  return (
    <PageContainer>
      <PageHeader eyebrow="Private" title="Account" description={description} />
      <div className="mt-12">
        <EmptyState
          icon={UserRound}
          title="Accounts are not enabled yet"
          description="Authentication and wallet linking will be added in a later step."
        />
      </div>
    </PageContainer>
  );
}
