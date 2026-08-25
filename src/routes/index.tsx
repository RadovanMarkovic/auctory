import { useQuery } from "@tanstack/react-query";
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

import heroImage from "@/assets/home-hero.jpg";
import { EmptyState, ErrorState, LoadingState } from "@/components/common";
import { LotCard } from "@/components/home/LotCard";
import { SectionHeading } from "@/components/home/Section";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { fetchHomeData, type HomeData } from "@/mocks/home";

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
  {
    icon: BadgeCheck,
    title: "Register and get verified",
    body: "Create an account, confirm your identity, and receive a bidding limit.",
  },
  {
    icon: Gavel,
    title: "Bid in ascending auctions",
    body: "Transparent increments, live bid history, and anti-sniping time extensions.",
  },
  {
    icon: ScrollText,
    title: "Settle and receive provenance",
    body: "Pay securely, then receive the piece with its on-chain certificate.",
  },
];

const trust = [
  { icon: ShieldCheck, label: "Specialist-vetted lots" },
  { icon: Landmark, label: "Escrowed settlement" },
  { icon: Link2, label: "Sepolia ERC-721 certificates" },
  { icon: Users, label: "Bilingual support, EN & SR" },
];

function Index() {
  const { data, isPending, isError, refetch } = useQuery<HomeData>({
    queryKey: ["home"],
    queryFn: fetchHomeData,
  });

  return (
    <>
      <Hero />

      <PageContainer className="space-y-24">
        <section>
          <SectionHeading
            eyebrow="Current sales"
            title="Featured live auctions"
            description="Highlights selected by our specialists across every department."
            action={
              <Button variant="outline" asChild>
                <Link to="/auctions">View all lots</Link>
              </Button>
            }
          />
          <div className="mt-10">
            <LotGrid
              lots={data?.featured}
              isPending={isPending}
              isError={isError}
              onRetry={() => void refetch()}
              emptyTitle="No featured lots right now"
              emptyDescription="Our next curated sale is being catalogued. Check back shortly."
            />
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="Closing today"
            title="Ending soon"
            description="Lots entering their final hours. Bids in the last minutes extend the clock."
          />
          <div className="mt-10">
            <LotGrid
              lots={data?.endingSoon}
              urgent
              isPending={isPending}
              isError={isError}
              onRetry={() => void refetch()}
              emptyTitle="Nothing closing today"
              emptyDescription="No lots are in their final hours at the moment."
            />
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="Departments"
            title="Luxury categories"
            description="Four departments, each with its own specialists and authentication process."
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {isPending
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="h-40 animate-pulse bg-muted/60" />
                ))
              : data?.categories.map((category) => (
                  <Card key={category.key} interactive>
                    <CardContent className="space-y-3 p-7">
                      <Badge variant="muted">{category.lotCount} lots</Badge>
                      <CardTitle>{category.name}</CardTitle>
                      <CardDescription className="leading-relaxed">
                        {category.blurb}
                      </CardDescription>
                      <Link
                        to="/categories"
                        className="inline-block pt-1 text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Browse {category.name.toLowerCase()}
                      </Link>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="Process"
            title="How Auctory works"
            description="Three steps from registration to a piece with verifiable provenance."
            action={
              <Button variant="outline" asChild>
                <Link to="/how-it-works">Read the full guide</Link>
              </Button>
            }
          />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, title: t, body }, index) => (
              <li key={t}>
                <Card className="h-full">
                  <CardContent className="space-y-3 p-7">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="eyebrow">Step {index + 1}</span>
                    </div>
                    <CardTitle>{t}</CardTitle>
                    <CardDescription className="leading-relaxed">{body}</CardDescription>
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
              <p className="eyebrow">Blockchain provenance</p>
              <h2 id="provenance-heading" className="font-display text-3xl sm:text-4xl">
                Every sold piece carries its own certificate
              </h2>
              <div className="rule-gold" aria-hidden="true" />
              <p className="leading-relaxed text-muted-foreground">
                When a lot settles, Auctory mints an ERC-721 certificate on the Sepolia
                network containing the lot reference, specialist report, and sale date. The
                certificate transfers with the object, so each future owner inherits a
                complete, tamper-evident ownership history.
              </p>
              <Button variant="outlineGold" asChild>
                <Link to="/how-it-works">See how certificates work</Link>
              </Button>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Sparkles, t: "Minted at settlement", b: "No manual paperwork." },
                { icon: Link2, t: "On-chain ownership log", b: "Each transfer is recorded." },
                { icon: ShieldCheck, t: "Specialist report", b: "Linked in the metadata." },
                { icon: Timer, t: "Permanent record", b: "Independent of Auctory." },
              ].map(({ icon: Icon, t, b }) => (
                <li key={t} className="rounded-lg border border-border bg-card p-5">
                  <Icon className="size-4 text-gold" aria-hidden="true" />
                  <p className="mt-3 font-display text-lg">{t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="sell-heading"
          className="rounded-lg border border-border bg-card p-8 text-center sm:p-14"
        >
          <p className="eyebrow">Consignment</p>
          <h2 id="sell-heading" className="mt-3 font-display text-3xl sm:text-4xl">
            Have a piece worth the catalogue?
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
            Submit your item for a free specialist estimate. Approved consignors receive
            photography, cataloguing, and a reserve agreed in writing before the sale opens.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/sell">Consign a piece</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/how-it-works">Seller terms</Link>
            </Button>
          </div>
        </section>

        <section>
          <dl className="grid gap-6 border-y border-border py-10 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Lots sold" value={data ? `${data.stats.lotsSold.toLocaleString()}+` : null} />
            <Stat
              label="Certificates minted"
              value={data ? `${data.stats.certificatesMinted.toLocaleString()}` : null}
            />
            <Stat
              label="Average sell-through"
              value={data ? `${data.stats.averageSellThrough}%` : null}
            />
            <Stat
              label="Registered bidders"
              value={data ? `${data.stats.registeredBidders.toLocaleString()}` : null}
            />
          </dl>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-4">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </section>
      </PageContainer>
    </>
  );
}

function Hero() {
  return (
    <section className="border-b border-border">
      <PageContainer className="py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="max-w-xl space-y-6">
            <Badge variant="gold">Bilingual auction house</Badge>
            <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">
              Exceptional objects,
              <br />
              rigorously verified.
            </h1>
            <div className="rule-gold" aria-hidden="true" />
            <p className="text-lg leading-relaxed text-muted-foreground">{description}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link to="/auctions">Browse auctions</Link>
              </Button>
              <Button size="lg" variant="outlineGold" asChild>
                <Link to="/sell">Consign a piece</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border shadow-lift">
            <img
              src={heroImage}
              alt="A gold wristwatch and a diamond ring photographed on a pale blue surface"
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
  urgent,
  isPending,
  isError,
  onRetry,
  emptyTitle,
  emptyDescription,
}: {
  lots: HomeData["featured"] | undefined;
  urgent?: boolean;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (isPending) return <LoadingState variant="cards" count={3} label="Loading lots" />;
  if (isError)
    return (
      <ErrorState
        title="Couldn't load these lots"
        description="The catalogue didn't respond. Please try again."
        onRetry={onRetry}
      />
    );
  if (!lots?.length)
    return <EmptyState icon={PackageOpen} title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {lots.map((lot) => (
        <LotCard key={lot.id} lot={lot} urgent={urgent ?? false} />
      ))}
    </div>
  );
}
