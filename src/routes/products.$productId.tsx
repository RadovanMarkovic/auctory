import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, FileText, Package, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { categoryName, useSignedImageUrls } from "@/lib/products";

export const Route = createFileRoute("/products/$productId")({
  head: () => ({
    meta: [
      { title: "Product — Auctory" },
      {
        name: "description",
        content:
          "Seller-described item on Auctory, with images, specification, provenance notes, and its future digital product passport.",
      },
      { property: "og:title", content: "Product — Auctory" },
      {
        property: "og:description",
        content: "Seller-described item on Auctory with provenance notes and digital passport.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "*, brands(name), categories(name_en, name_sr), product_images(id, storage_path, caption, is_cover, sort_order)",
        )
        .eq("id", productId)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const product = productQuery.data ?? null;

  const sellerQuery = useQuery({
    queryKey: ["product-seller", product?.seller_id],
    enabled: Boolean(product?.seller_id),
    queryFn: async () => {
      if (!product?.seller_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, country")
        .eq("id", product.seller_id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const images = [...(product?.product_images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
  );
  const urls = useSignedImageUrls(images.map((image) => image.storage_path)).data ?? {};
  const active = images[activeIndex] ?? images[0];

  if (productQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <PageContainer>
        <ErrorState
          title={t("products.detail.notFoundTitle")}
          description={t("products.detail.notFoundDescription")}
          onRetry={() => void productQuery.refetch()}
        />
      </PageContainer>
    );
  }

  const specs: { label: string; value: string | null }[] = [
    { label: t("products.fields.brand"), value: product.brands?.name ?? null },
    {
      label: t("products.fields.category"),
      value: product.categories ? categoryName(product.categories, i18n.language) : null,
    },
    { label: t("products.fields.model"), value: product.model },
    { label: t("products.fields.serialNumber"), value: product.serial_number },
    {
      label: t("products.fields.productionYear"),
      value: product.production_year ? String(product.production_year) : null,
    },
    {
      label: t("products.fields.condition"),
      value: product.condition
        ? t(`products.conditions.${product.condition}`, { defaultValue: product.condition })
        : null,
    },
    { label: t("products.fields.material"), value: product.material },
    { label: t("products.fields.countryOfOrigin"), value: product.country_of_origin },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={product.brands?.name ?? t("products.catalogue.eyebrow")}
        title={product.title}
        {...(product.model ? { description: product.model } : {})}
      />

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="surface-gradient flex aspect-4/3 items-center justify-center overflow-hidden rounded-md border border-border">
            {active && urls[active.storage_path] ? (
              <img
                src={urls[active.storage_path]}
                alt={active.caption ?? product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-6xl text-muted-foreground/50">
                {product.title.charAt(0)}
              </span>
            )}
          </div>
          {images.length > 1 ? (
            <div className="grid grid-cols-5 gap-3">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={t("products.detail.viewImage", { number: index + 1 })}
                  className={`surface-gradient aspect-square overflow-hidden rounded-md border ${
                    index === activeIndex ? "border-primary" : "border-border"
                  }`}
                >
                  {urls[image.storage_path] ? (
                    <img
                      src={urls[image.storage_path]}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("products.detail.information")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-3">
                {specs
                  .filter((spec) => spec.value)
                  .map((spec) => (
                    <div key={spec.label} className="flex justify-between gap-6 text-sm">
                      <dt className="text-muted-foreground">{spec.label}</dt>
                      <dd className="text-right">{spec.value}</dd>
                    </div>
                  ))}
              </dl>
              <div className="flex flex-wrap gap-2 pt-2">
                {product.has_original_box ? (
                  <Badge variant="outline">
                    <Package /> {t("products.fields.hasOriginalBox")}
                  </Badge>
                ) : null}
                {product.has_documents ? (
                  <Badge variant="outline">
                    <FileText /> {t("products.fields.hasDocuments")}
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("products.detail.seller")}</CardTitle>
              <CardDescription>{t("products.detail.sellerHint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{sellerQuery.data?.full_name ?? t("products.detail.sellerAnonymous")}</p>
              {sellerQuery.data?.country ? (
                <p className="text-muted-foreground">{sellerQuery.data.country}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="size-5" />
                {t("products.detail.passportTitle")}
              </CardTitle>
              <CardDescription>{t("products.detail.passportDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{t("products.detail.passportPending")}</Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {product.description ? (
        <section className="mt-12 max-w-3xl space-y-3">
          <h2 className="font-display text-3xl">{t("products.fields.description")}</h2>
          <p className="leading-relaxed whitespace-pre-line text-muted-foreground">
            {product.description}
          </p>
        </section>
      ) : null}

      {product.provenance_notes ? (
        <section className="mt-10 max-w-3xl space-y-3">
          <h2 className="font-display text-3xl">{t("products.fields.provenanceNotes")}</h2>
          <p className="leading-relaxed whitespace-pre-line text-muted-foreground">
            {product.provenance_notes}
          </p>
        </section>
      ) : null}

      <p className="mt-12 flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <ShieldQuestion className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("products.disclaimer")}
      </p>
    </PageContainer>
  );
}
