import { createFileRoute, Link } from "@tanstack/react-router";
import { Gavel, ShieldCheck, Sparkles } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common";

const title = "Auctory — Curated Auctions for Watches, Jewelry & Collectibles";
const description =
  "Auctory is a bilingual auction house for luxury watches, fine jewelry, collectibles, and limited-edition fashion, with on-chain certificates of provenance.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Index,
});

const pillars = [
  {
    icon: Gavel,
    title: "English ascending auctions",
    body: "Transparent, timed bidding with clear increments and anti-sniping extensions.",
  },
  {
    icon: ShieldCheck,
    title: "Vetted consignments",
    body: "Every lot passes seller approval and specialist review before it goes live.",
  },
  {
    icon: Sparkles,
    title: "On-chain provenance",
    body: "Each sold piece carries an ERC-721 certificate with a permanent ownership history.",
  },
];

function Index() {
  return (
    <>
      <section className="border-b border-border">
        <PageContainer className="py-20 sm:py-28">
          <div className="max-w-3xl space-y-6">
            <Badge variant="gold">Bilingual auction house</Badge>
            <h1 className="font-display text-5xl leading-[1.05] sm:text-7xl">
              Exceptional objects,
              <br />
              rigorously verified.
            </h1>
            <div className="rule-gold" aria-hidden="true" />
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              {description}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link to="/auctions">Browse auctions</Link>
              </Button>
              <Button size="lg" variant="outlineGold" asChild>
                <Link to="/sell">Consign a piece</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer>
        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title: t, body }) => (
            <Card key={t} interactive>
              <CardContent className="space-y-3 p-7">
                <Icon className="size-5 text-gold" aria-hidden="true" />
                <CardTitle>{t}</CardTitle>
                <CardDescription className="leading-relaxed">{body}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 space-y-6">
          <p className="eyebrow">Current sales</p>
          <EmptyState
            icon={Gavel}
            title="No auctions published yet"
            description="Catalogue data arrives in the next build step. The shell, design system, and routes are ready."
            action={
              <Button variant="outline" asChild>
                <Link to="/how-it-works">How Auctory works</Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    </>
  );
}
