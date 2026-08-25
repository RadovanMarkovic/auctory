import { createFileRoute } from "@tanstack/react-router";
import { PackageOpen } from "lucide-react";

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
  return (
    <PageContainer>
      <PageHeader eyebrow="Consignment" title="Sell with Auctory" description={description} />
      <div className="mt-12">
        <EmptyState
          icon={PackageOpen}
          title="Submission flow coming soon"
          description="Seller onboarding, lot submission, and approval workflow arrive in a later step."
        />
      </div>
    </PageContainer>
  );
}
