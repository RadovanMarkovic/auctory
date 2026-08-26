import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Gavel, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuctionCard } from "@/components/auctions/AuctionCard";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRODUCT_CONDITIONS, useBrands, useCategories, useSignedImageUrls } from "@/lib/products";
import { AUCTION_TABS, useNow, usePublicAuctions, type AuctionTab } from "@/lib/public-auctions";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuctionsPage,
});

const ALL = "all";

function AuctionsPage() {
  const { t } = useTranslation();
  const now = useNow(1000);

  const [tab, setTab] = useState<AuctionTab>("live");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [brand, setBrand] = useState(ALL);
  const [condition, setCondition] = useState(ALL);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const auctionsQuery = usePublicAuctions(tab);
  const categoriesQuery = useCategories();
  const brandsQuery = useBrands();

  const auctions = auctionsQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const min = Number.parseFloat(minPrice);
    const max = Number.parseFloat(maxPrice);
    return auctions.filter((auction) => {
      if (category !== ALL && auction.categoryId !== category) return false;
      if (brand !== ALL && auction.brandId !== brand) return false;
      if (condition !== ALL && auction.condition !== condition) return false;
      if (Number.isFinite(min) && auction.currentPrice < min) return false;
      if (Number.isFinite(max) && auction.currentPrice > max) return false;
      if (term) {
        const haystack = [auction.title, auction.model, auction.brandName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [auctions, brand, category, condition, maxPrice, minPrice, search]);

  const imagePaths = useMemo(
    () => filtered.map((auction) => auction.coverPath).filter((p): p is string => Boolean(p)),
    [filtered],
  );
  const imagesQuery = useSignedImageUrls(imagePaths);
  const imageUrls = imagesQuery.data ?? {};

  const hasFilters =
    search !== "" ||
    category !== ALL ||
    brand !== ALL ||
    condition !== ALL ||
    minPrice !== "" ||
    maxPrice !== "";

  function resetFilters() {
    setSearch("");
    setCategory(ALL);
    setBrand(ALL);
    setCondition(ALL);
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("pages.auctions.eyebrow")}
        title={t("pages.auctions.title")}
        description={t("pages.auctions.description")}
      />

      <div className="mt-10 space-y-6">
        <Tabs value={tab} onValueChange={(value) => setTab(value as AuctionTab)}>
          <TabsList>
            {AUCTION_TABS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(`auctions.tabs.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="auction-search">{t("auctions.filters.search")}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="auction-search"
                value={search}
                className="pl-9"
                placeholder={t("auctions.filters.searchPlaceholder")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auction-category">{t("auctions.filters.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="auction-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("auctions.filters.all")}</SelectItem>
                {(categoriesQuery.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {t(`categories.${item.slug}.name`, { defaultValue: item.name_en })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auction-brand">{t("auctions.filters.brand")}</Label>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger id="auction-brand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("auctions.filters.all")}</SelectItem>
                {(brandsQuery.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auction-condition">{t("auctions.filters.condition")}</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger id="auction-condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("auctions.filters.all")}</SelectItem>
                {PRODUCT_CONDITIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`products.conditions.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auction-min-price">{t("auctions.filters.priceRange")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="auction-min-price"
                inputMode="decimal"
                placeholder={t("auctions.filters.min")}
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
              />
              <Input
                inputMode="decimal"
                aria-label={t("auctions.filters.max")}
                placeholder={t("auctions.filters.max")}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </div>
          </div>

          {hasFilters ? (
            <div className="flex items-end sm:col-span-2 lg:col-span-6">
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                {t("auctions.filters.reset")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-10">
        {auctionsQuery.isLoading ? (
          <LoadingState />
        ) : auctionsQuery.isError ? (
          <ErrorState onRetry={() => void auctionsQuery.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title={t(`auctions.catalogue.empty.${tab}Title`)}
            description={
              hasFilters
                ? t("auctions.catalogue.empty.filtered")
                : t(`auctions.catalogue.empty.${tab}Description`)
            }
            {...(hasFilters
              ? {
                  action: (
                    <Button variant="outline" onClick={resetFilters}>
                      {t("auctions.filters.reset")}
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((auction) => (
              <li key={auction.id}>
                <AuctionCard
                  auction={auction}
                  now={now}
                  imageUrl={auction.coverPath ? imageUrls[auction.coverPath] : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
