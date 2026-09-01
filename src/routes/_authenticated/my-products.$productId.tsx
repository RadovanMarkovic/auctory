import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  ProductForm,
  toProductPayload,
  type ProductFormValues,
} from "@/components/products/ProductForm";
import { ProductImageManager } from "@/components/products/ProductImageManager";
import { ProvenanceAttachment } from "@/components/products/ProvenanceAttachment";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { WalletRequiredNotice } from "@/components/wallet/WalletRequiredNotice";
import { useAuth } from "@/lib/auth-context";
import { isSepoliaVerified, useVerifiedWallet } from "@/lib/wallet/verify";
import type { ProductStatus } from "@/lib/products";

const title = "Edit Product — Auctory";
const description = "Edit your Auctory listing, manage its images, and publish it when ready.";

export const Route = createFileRoute("/_authenticated/my-products/$productId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditProductPage,
});

function EditProductPage() {
  const { productId } = Route.useParams();
  const { t } = useTranslation();
  const walletVerified = isSepoliaVerified(useVerifiedWallet().data);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const productQuery = useQuery({
    queryKey: ["seller-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*)")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const product = productQuery.data ?? null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["seller-product", productId] });
    void queryClient.invalidateQueries({ queryKey: ["my-products", user?.id] });
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const { error } = await supabase
        .from("products")
        .update(toProductPayload(values))
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("products.form.saved"));
      invalidate();
    },
    onError: () => toast.error(t("products.form.saveFailed")),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: ProductStatus) => {
      const { error } = await supabase.from("products").update({ status }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("products.manage.statusUpdated"));
      invalidate();
    },
    onError: () => toast.error(t("common.errorTitle")),
  });

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

  const images = [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const initialValues: ProductFormValues = {
    category_id: product.category_id,
    brand_id: product.brand_id,
    title: product.title,
    model: product.model ?? "",
    description: product.description ?? "",
    serial_number: product.serial_number ?? "",
    production_year: product.production_year ? String(product.production_year) : "",
    condition: product.condition ?? "",
    material: product.material ?? "",
    country_of_origin: product.country_of_origin ?? "",
    provenance_notes: product.provenance_notes ?? "",
    has_original_box: product.has_original_box,
    has_documents: product.has_documents,
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("products.manage.eyebrow")}
        title={product.title}
        description={t("products.form.editDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{t(`products.status.${product.status}`)}</Badge>
            <Button asChild variant="ghost">
              <Link to="/my-products">{t("products.manage.backToList")}</Link>
            </Button>
          </div>
        }
      />

      <WalletRequiredNotice context="seller" />

      <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t("products.disclaimer")}
      </p>

      <div className="mt-10 space-y-8">
        <ProductForm
          key={product.updated_at}
          initialValues={initialValues}
          submitting={saveMutation.isPending}
          onSubmit={(values) => saveMutation.mutate(values)}
          provenanceSlot={
            <ProvenanceAttachment
              productId={product.id}
              sellerId={product.seller_id}
              path={product.provenance_document_path}
              name={product.provenance_document_name}
            />
          }
          footerSlot={
            <ProductImageManager
              productId={product.id}
              sellerId={product.seller_id}
              images={images}
            />
          }
          actions={
            <>
              {product.status === "draft" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={images.length === 0 || !walletVerified}
                  title={
                    images.length === 0
                      ? t("products.manage.needImage")
                      : !walletVerified
                        ? t("wallet.required.seller")
                        : undefined
                  }
                  onClick={() => statusMutation.mutate("published")}
                >
                  {t("products.manage.publish")}
                </Button>
              ) : null}
              {product.status === "published" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => statusMutation.mutate("draft")}
                >
                  {t("products.manage.unpublish")}
                </Button>
              ) : null}
              {product.status !== "archived" ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => statusMutation.mutate("archived")}
                >
                  {t("products.manage.archive")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => statusMutation.mutate("draft")}
                >
                  {t("products.manage.restore")}
                </Button>
              )}
            </>
          }
        />
      </div>
    </PageContainer>
  );
}
