import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";

const title = "How Auctory Works — Bidding, Payment & Certificates";
const description =
  "From vetted consignment to English ascending bidding, settlement, and an ERC-721 certificate of provenance.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: HowItWorksPage,
});

const steps = [
  { step: "01", name: "Consign", body: "Sellers submit a lot; specialists review and approve it." },
  { step: "02", name: "Bid", body: "Timed English ascending auction with clear bid increments." },
  { step: "03", name: "Settle", body: "The winner completes a simulated post-auction payment." },
  { step: "04", name: "Certify", body: "An ERC-721 certificate records ownership on Sepolia." },
];

function HowItWorksPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Process" title="How it works" description={description} />
      <ol className="mt-12 divide-y divide-border border-y border-border">
        {steps.map((s) => (
          <li key={s.step} className="grid gap-3 py-8 sm:grid-cols-[6rem_1fr_2fr] sm:items-baseline">
            <span className="font-display text-3xl text-gold">{s.step}</span>
            <h2 className="font-display text-2xl">{s.name}</h2>
            <p className="leading-relaxed text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}
