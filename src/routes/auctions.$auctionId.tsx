import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, ImageOff, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BidPanel } from "@/components/auctions/BidPanel";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAuctionDate, formatAuctionMoney } from "@/lib/auctions";
import { useSignedImageUrls } from "@/lib/products";
import {
  formatCountdown,
  useAuctionBidHistory,
  useNow,
  usePublicAuction,
  useSellerSummary,
} from "@/lib/public-auctions";

const title = "Auction Lot — Auctory";
const description =
  "Lot details, current bid, bidding history, and provenance information for an Auctory auction lot.";

export const Route = createFileRoute("/auctions/$auctionId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuctionDetailPage,
});

function AuctionDetailPage() {
  const { auctionId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("sr") ? "sr-RS" : "en-GB";
  const now = useNow(1000);
  const [activeImage, setActiveImage] = useState(0);

  const detailQuery = usePublicAuction(auctionId);
  const detail = detailQuery.data;
  const auction = detail?.auction;
  const product = detail?.product;

  const images = useMemo(() => {
    const list = [...(product?.product_images ?? [])];
    list.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
    return list;
  }, [product]);

  const imagesQuery = useSignedImageUrls(images.map((image) => image.storage_path));
  const imageUrls = imagesQuery.data ?? {};
  const bidsQuery = useAuctionBidHistory(auctionId, Boolean(auction));
  const sellerQuery = useSellerSummary(auction?.seller_id);

  if (detailQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (detailQuery.isError) {
    return (
      <PageContainer>
        <ErrorState onRetry={() => void detailQuery.refetch()} />
      </PageContainer>
    );
  }

  if (!auction || !product) {
    return (
      <PageContainer>
        <EmptyState
          title={t("auctions.detail.notFoundTitle")}
          description={t("auctions.detail.notFoundDescription")}
        />
      </PageContainer>
    );
  }

  const status = auction.status ?? "ended";
  const currentPrice = Number(auction.current_price ?? auction.start_price ?? 0);
  const minimumNextBid = Number(auction.minimum_next_bid ?? auction.start_price ?? 0);
  const target = status === "scheduled" ? auction.starts_at : auction.ends_at;
  const countdown = target ? formatCountdown(target, now, t("auctions.card.finished")) : "—";
  const activePath = images[activeImage]?.storage_path;
  const activeUrl = activePath ? imageUrls[activePath] : undefined;
  const facts: { label: string; value: string | null }[] = [
    { label: t("products.fields.brand"), value: product.brands?.name ?? null },
    {
      label: t("products.fields.category"),
      value: product.categories
        ? locale === "sr-RS"
          ? product.categories.name_sr
          : product.categories.name_en
        : null,
    },
    { label: t("products.fields.model"), value: product.model },
    { label: t("products.fields.serialNumber"), value: product.serial_number },
    {
      label: t("products.fields.condition"),
      value: product.condition ? t(`products.conditions.${product.condition}`) : null,
    },
    { label: t("products.fields.material"), value: product.material },
    {
      label: t("products.fields.productionYear"),
      value: product.production_year ? String(product.production_year) : null,
    },
    { label: t("products.fields.countryOfOrigin"), value: product.country_of_origin },
    {
      label: t("products.fields.hasOriginalBox"),
      value: product.has_original_box ? t("common.yes") : t("common.no"),
    },
    {
      label: t("products.fields.hasDocuments"),
      value: product.has_documents ? t("common.yes") : t("common.no"),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={product.brands?.name ?? t("pages.lot.eyebrow", { id: auctionId.slice(0, 8) })}
        title={product.title}
        {...(product.model ? { description: product.model } : {})}
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="surface-gradient flex aspect-4/3 items-center justify-center overflow-hidden rounded-lg border border-border">
            {activeUrl ? (
              <img src={activeUrl} alt={product.title} className="size-full object-cover" />
            ) : (
              <ImageOff className="size-10 text-muted-foreground/50" aria-hidden="true" />
            )}
          </div>
          {images.length > 1 ? (
            <ul className="grid grid-cols-5 gap-3">
              {images.map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={t("auctions.detail.viewImage", { index: index + 1 })}
                    className={`aspect-square w-full overflow-hidden rounded-md border ${
                      index === activeImage ? "border-primary" : "border-border"
                    }`}
                  >
                    {imageUrls[image.storage_path] ? (
                      <img
                        src={imageUrls[image.storage_path]}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t("auctions.detail.productDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {facts
                .filter((fact) => fact.value)
                .map((fact) => (
                  <div key={fact.label}>
                    <p className="eyebrow">{fact.label}</p>
                    <p className="text-sm">{fact.value}</p>
                  </div>
                ))}
            </CardContent>
          </Card>

          {product.description ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("products.fields.description")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {product.description}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {product.provenance_notes ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("products.fields.provenanceNotes")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {product.provenance_notes}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <p className="flex items-start gap-2 rounded-lg border border-dashed border-border p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("products.disclaimer")}
          </p>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex items-center justify-between gap-3">
                <Badge
                  variant={status === "live" ? "live" : status === "scheduled" ? "upcoming" : "outline"}
                >
                  {t(`auctions.status.${status}`)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {status === "scheduled"
                    ? t("auctions.card.startsIn", { value: countdown })
                    : status === "live"
                      ? t("auctions.card.endsIn", { value: countdown })
                      : t("auctions.card.finished")}
                </span>
              </div>
              <CardTitle className="font-display text-3xl">
                {formatAuctionMoney(currentPrice, locale)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {(auction.bid_count ?? 0) > 0
                  ? t("auctions.card.currentBid")
                  : t("auctions.card.startingPrice")}{" "}
                · {t("auctions.card.bids", { count: auction.bid_count ?? 0 })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {auction.has_reserve ? (
                <p className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="size-4" aria-hidden="true" />
                  {auction.reserve_met
                    ? t("auctions.detail.reserveMet")
                    : t("auctions.detail.reserveNotMet")}
                </p>
              ) : null}
              <Separator />
              <BidPanel
                auctionId={auctionId}
                sellerId={auction.seller_id}
                minimumNextBid={minimumNextBid}
                isLive={status === "live"}
                locale={locale}
              />
              {status === "scheduled" && auction.starts_at ? (
                <p className="text-xs text-muted-foreground">
                  {t("auctions.detail.startsAt", {
                    value: formatAuctionDate(auction.starts_at, locale),
                  })}
                </p>
              ) : null}
              {auction.ends_at ? (
                <p className="text-xs text-muted-foreground">
                  {t("auctions.detail.endsAt", {
                    value: formatAuctionDate(auction.ends_at, locale),
                  })}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("auctions.detail.seller")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">
                {sellerQuery.data?.full_name ?? t("auctions.detail.sellerUnknown")}
              </p>
              {sellerQuery.data?.country ? (
                <p className="text-muted-foreground">{sellerQuery.data.country}</p>
              ) : null}
              {sellerQuery.data?.member_since ? (
                <p className="text-muted-foreground">
                  {t("auctions.detail.memberSince", {
                    value: formatAuctionDate(sellerQuery.data.member_since, locale),
                  })}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("auctions.detail.bidHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              {(bidsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("auctions.detail.noBids")}</p>
              ) : (
                <ul className="space-y-3">
                  {(bidsQuery.data ?? []).map((bid) => (
                    <li key={bid.bid_id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {bid.bidder_label}
                        {bid.is_own ? ` · ${t("auctions.detail.you")}` : ""}
                      </span>
                      <span className="font-medium">
                        {formatAuctionMoney(Number(bid.amount), locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("auctions.detail.passportTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("auctions.detail.passportDescription")}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
