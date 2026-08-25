import { createFileRoute } from "@tanstack/react-router";
import { Gavel } from "lucide-react";

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
  return (
    <PageContainer>
      <PageHeader eyebrow="Catalogue" title="Auctions" description={description} />
      <div className="mt-12">
        <EmptyState
          icon={Gavel}
          title="Catalogue coming soon"
          description="Auction listings and bidding will be connected in a later step."
        />
      </div>
    </PageContainer>
  );
}
