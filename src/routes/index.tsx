import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Gavel,
  Landmark,
  Link2,
  PackageOpen,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import heroImage from "@/assets/home-hero.jpg";
import { AuctionCard } from "@/components/auctions/AuctionCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common";
import { SectionHeading } from "@/components/home/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { useHomeHighlights, useHomeStats } from "@/lib/home";
import { categoryName, useCategories, useSignedImageUrls } from "@/lib/products";
import { useNow, type AuctionListItem } from "@/lib/public-auctions";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: BadgeCheck, key: "register" },
  { icon: Gavel, key: "bid" },
  { icon: ScrollText, key: "settle" },
] as const;

const trust = [
  { icon: ShieldCheck, key: "vetted" },
  { icon: Landmark, key: "escrow" },
  { icon: Link2, key: "certificates" },
  { icon: Users, key: "support" },
] as const;

const provenancePoints = [
  { icon: Sparkles, key: "minted" },
  { icon: Link2, key: "log" },
  { icon: ShieldCheck, key: "report" },
  { icon: Timer, key: "permanent" },
] as const;

function Index() {
  const { t, i18n } = useTranslation();
  const now = useNow(1000);
  const { featured, endingSoon, openAuctions, isPending, isError, refetch } = useHomeHighlights();
  const categoriesQuery = useCategories();

  const imagePaths = useMemo(
    () =>
      [...featured, ...endingSoon]
        .map((auction) => auction.coverPath)
        .filter((path): path is string => Boolean(path)),
    [featured, endingSoon],
  );
  const imageUrls = useSignedImageUrls(imagePaths).data ?? {};

  const lotCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const auction of openAuctions) {
      if (!auction.categoryId) continue;
      counts.set(auction.categoryId, (counts.get(auction.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [openAuctions]);

  return (
    <>
      <Hero />

      <PageContainer className="space-y-24">
        <section>
          <SectionHeading
            eyebrow={t("home.featured.eyebrow")}
            title={t("home.featured.title")}
            description={t("home.featured.description")}
            action={
              <Button variant="outline" asChild>
                <Link to="/auctions">{t("home.featured.viewAll")}</Link>
              </Button>
            }
          />
          <div className="mt-10">
            <LotGrid
              lots={featured}
              now={now}
              imageUrls={imageUrls}
              isPending={isPending}
              isError={isError}
              onRetry={refetch}
              emptyTitle={t("home.featured.emptyTitle")}
              emptyDescription={t("home.featured.emptyDescription")}
            />
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow={t("home.endingSoon.eyebrow")}
            title={t("home.endingSoon.title")}
            description={t("home.endingSoon.description")}
          />
          <div className="mt-10">
            <LotGrid
              lots={endingSoon}
              now={now}
              imageUrls={imageUrls}
              isPending={isPending}
              isError={isError}
              onRetry={refetch}
              emptyTitle={t("home.endingSoon.emptyTitle")}
              emptyDescription={t("home.endingSoon.emptyDescription")}
            />
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow={t("home.categories.eyebrow")}
            title={t("home.categories.title")}
            description={t("home.categories.description")}
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {categoriesQuery.isPending
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="h-40 animate-pulse bg-muted/60" />
                ))
              : (categoriesQuery.data ?? []).map((category) => {
                  const name = categoryName(category, i18n.language);
                  return (
                    <Card key={category.id} interactive>
                      <CardContent className="space-y-3 p-7">
                        <Badge variant="muted">
                          {t("lot.lotCount", { count: lotCounts.get(category.id) ?? 0 })}
                        </Badge>
                        <CardTitle>{name}</CardTitle>
                        <CardDescription className="leading-relaxed">
                          {t(`categories.${category.slug}.blurb`, { defaultValue: "" })}
                        </CardDescription>
                        <Link
                          to="/auctions"
                          className="inline-block pt-1 text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {t("lot.browse", { category: name.toLowerCase() })}
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>
        </section>


        <section>
          <SectionHeading
            eyebrow={t("home.steps.eyebrow")}
            title={t("home.steps.title")}
            description={t("home.steps.description")}
            action={
              <Button variant="outline" asChild>
                <Link to="/how-it-works">{t("home.steps.guide")}</Link>
              </Button>
            }
          />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, key }, index) => (
              <li key={key}>
                <Card className="h-full">
                  <CardContent className="space-y-3 p-7">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="eyebrow">{t("common.step", { number: index + 1 })}</span>
                    </div>
                    <CardTitle>{t(`home.steps.${key}.title`)}</CardTitle>
                    <CardDescription className="leading-relaxed">
                      {t(`home.steps.${key}.body`)}
                    </CardDescription>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="provenance-heading"
          className="surface-gradient rounded-lg border border-border p-8 sm:p-12"
        >
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-5">
              <p className="eyebrow">{t("home.provenance.eyebrow")}</p>
              <h2 id="provenance-heading" className="font-display text-3xl sm:text-4xl">
                {t("home.provenance.title")}
              </h2>
              <div className="rule-gold" aria-hidden="true" />
              <p className="leading-relaxed text-muted-foreground">{t("home.provenance.body")}</p>
              <Button variant="outlineGold" asChild>
                <Link to="/how-it-works">{t("home.provenance.cta")}</Link>
              </Button>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {provenancePoints.map(({ icon: Icon, key }) => (
                <li key={key} className="rounded-lg border border-border bg-card p-5">
                  <Icon className="size-4 text-gold" aria-hidden="true" />
                  <p className="mt-3 font-display text-lg">{t(`home.provenance.${key}.title`)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`home.provenance.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="sell-heading"
          className="rounded-lg border border-border bg-card p-8 text-center sm:p-14"
        >
          <p className="eyebrow">{t("home.sell.eyebrow")}</p>
          <h2 id="sell-heading" className="mt-3 font-display text-3xl sm:text-4xl">
            {t("home.sell.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
            {t("home.sell.body")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/sell">{t("home.sell.cta")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/how-it-works">{t("home.sell.terms")}</Link>
            </Button>
          </div>
        </section>

        <section>
          <dl className="grid gap-6 border-y border-border py-10 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={t("home.stats.lotsSold")}
              value={data ? `${data.stats.lotsSold.toLocaleString()}+` : null}
            />
            <Stat
              label={t("home.stats.certificatesMinted")}
              value={data ? `${data.stats.certificatesMinted.toLocaleString()}` : null}
            />
            <Stat
              label={t("home.stats.sellThrough")}
              value={data ? `${data.stats.averageSellThrough}%` : null}
            />
            <Stat
              label={t("home.stats.bidders")}
              value={data ? `${data.stats.registeredBidders.toLocaleString()}` : null}
            />
          </dl>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-4">
            {trust.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                {t(`home.trust.${key}`)}
              </li>
            ))}
          </ul>
        </section>
      </PageContainer>
    </>
  );
}

function Hero() {
  const { t } = useTranslation();

  return (
    <section className="border-b border-border">
      <PageContainer className="py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="max-w-xl space-y-6">
            <Badge variant="gold">{t("home.hero.badge")}</Badge>
            <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">
              {t("home.hero.titleLine1")}
              <br />
              {t("home.hero.titleLine2")}
            </h1>
            <div className="rule-gold" aria-hidden="true" />
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t("home.meta.description")}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link to="/auctions">{t("home.hero.browse")}</Link>
              </Button>
              <Button size="lg" variant="outlineGold" asChild>
                <Link to="/sell">{t("home.hero.consign")}</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border shadow-lift">
            <img
              src={heroImage}
              alt={t("home.hero.imageAlt")}
              width={1400}
              height={1050}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </PageContainer>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-center">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 font-display text-4xl">
        {value ?? <span className="inline-block h-9 w-24 animate-pulse rounded bg-muted" />}
      </dd>
    </div>
  );
}

function LotGrid({
  lots,
  now,
  imageUrls,
  isPending,
  isError,
  onRetry,
  emptyTitle,
  emptyDescription,
}: {
  lots: AuctionListItem[];
  now: number;
  imageUrls: Record<string, string>;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { t } = useTranslation();

  if (isPending) return <LoadingState variant="cards" count={3} label={t("home.lots.loading")} />;
  if (isError)
    return (
      <ErrorState
        title={t("home.lots.errorTitle")}
        description={t("home.lots.errorDescription")}
        onRetry={onRetry}
      />
    );
  if (!lots.length)
    return <EmptyState icon={PackageOpen} title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {lots.map((auction) => (
        <AuctionCard
          key={auction.id}
          auction={auction}
          now={now}
          imageUrl={auction.coverPath ? imageUrls[auction.coverPath] : undefined}
        />
      ))}
    </div>
  );
}

