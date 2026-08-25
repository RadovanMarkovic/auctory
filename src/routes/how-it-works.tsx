import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

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

const steps = ["consign", "bid", "settle", "certify"] as const;

function HowItWorksPage() {
  const { t } = useTranslation();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("pages.howItWorks.eyebrow")}
        title={t("pages.howItWorks.title")}
        description={t("pages.howItWorks.description")}
      />
      <ol className="mt-12 divide-y divide-border border-y border-border">
        {steps.map((key, index) => (
          <li key={key} className="grid gap-3 py-8 sm:grid-cols-[6rem_1fr_2fr] sm:items-baseline">
            <span className="font-display text-3xl text-gold">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="font-display text-2xl">{t(`pages.howItWorks.steps.${key}.name`)}</h2>
            <p className="leading-relaxed text-muted-foreground">
              {t(`pages.howItWorks.steps.${key}.body`)}
            </p>
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}
