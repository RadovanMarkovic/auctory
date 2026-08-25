import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { categoryName, useSignedImageUrls } from "@/lib/products";

const title = "Product Catalogue — Auctory";
const description =
  "Browse published Auctory listings: luxury watches, fine jewelry, collectibles, and limited-edition fashion, described by their sellers.";

export const Route = createFileRoute("/products/")({
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
  component: CataloguePage,
});

function useCatalogue() {
  return useQuery({
    queryKey: ["catalogue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, model, condition, production_year, brands(name), categories(name_en, name_sr), product_images(storage_path, is_cover)",
        )
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function CataloguePage() {
  const { t, i18n } = useTranslation();
  const catalogueQuery = useCatalogue();
  const products = catalogueQuery.data ?? [];

  const coverPaths = products
    .map((product) => {
      const images = product.product_images ?? [];
      return (images.find((image) => image.is_cover) ?? images[0])?.storage_path;
    })
    .filter((path): path is string => Boolean(path));

  const urls = useSignedImageUrls(coverPaths).data ?? {};

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("products.catalogue.eyebrow")}
        title={t("products.catalogue.title")}
        description={t("products.catalogue.description")}
      />

      <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t("products.disclaimer")}
      </p>

      <div className="mt-12">
        {catalogueQuery.isLoading ? (
          <LoadingState />
        ) : catalogueQuery.isError ? (
          <ErrorState onRetry={() => void catalogueQuery.refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={t("products.catalogue.emptyTitle")}
            description={t("products.catalogue.emptyDescription")}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const images = product.product_images ?? [];
              const cover = images.find((image) => image.is_cover) ?? images[0];
              const url = cover ? urls[cover.storage_path] : undefined;
              return (
                <Card key={product.id} interactive className="group h-full overflow-hidden">
                  <Link
                    to="/products/$productId"
                    params={{ productId: product.id }}
                    className="flex h-full flex-col"
                  >
                    <div className="surface-gradient flex aspect-4/3 items-center justify-center border-b border-border">
                      {url ? (
                        <img
                          src={url}
                          alt={product.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="font-display text-5xl text-muted-foreground/50">
                          {product.title.charAt(0)}
                        </span>
                      )}
                    </div>
                    <CardContent className="flex-1 space-y-2 p-6">
                      <p className="eyebrow">
                        {product.brands?.name ?? t("products.fields.brandUnknown")}
                      </p>
                      <h2 className="font-display text-2xl leading-tight">{product.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {[product.model, product.production_year].filter(Boolean).join(" · ")}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {product.categories ? (
                          <Badge variant="outline">
                            {categoryName(product.categories, i18n.language)}
                          </Badge>
                        ) : null}
                        {product.condition ? (
                          <Badge variant="outline">
                            {t(`products.conditions.${product.condition}`, {
                              defaultValue: product.condition,
                            })}
                          </Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
