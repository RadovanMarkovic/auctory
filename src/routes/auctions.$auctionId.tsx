import { createFileRoute } from "@tanstack/react-router";

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

  return (
    <PageContainer>
      <PageHeader eyebrow={`Lot ${auctionId}`} title="Lot details" description={description} />
      <div className="mt-12">
        <EmptyState
          title="Lot view not built yet"
          description="Bidding, payment, and certificate panels will render here."
        />
      </div>
    </PageContainer>
  );
}
