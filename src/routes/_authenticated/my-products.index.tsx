import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PackagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-roles";
import type { ProductStatus } from "@/lib/products";

const title = "My Products — Auctory";
const description = "Manage your private Auctory listings: drafts and archived products.";

export const Route = createFileRoute("/_authenticated/my-products/")({
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
  component: MyProductsPage,
});

const STATUSES: ProductStatus[] = ["draft", "archived"];

function MyProductsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSeller, isLoading: rolesLoading } = useRoles();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ["my-products", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, model, status, updated_at, brands(name), product_images(id)")
        .eq("seller_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProductStatus }) => {
      const { error } = await supabase.from("products").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("products.manage.statusUpdated"));
      void queryClient.invalidateQueries({ queryKey: ["my-products", user?.id] });
    },
    onError: () => toast.error(t("common.errorTitle")),
  });

  if (rolesLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (!isSeller) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow={t("products.manage.eyebrow")}
          title={t("products.manage.title")}
          description={t("products.manage.description")}
        />
        <div className="mt-12">
          <EmptyState
            title={t("products.manage.notSellerTitle")}
            description={t("products.manage.notSellerDescription")}
            action={
              <Button asChild variant="outline">
                <Link to="/profile">{t("seller.become")}</Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    );
  }

  const products = productsQuery.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("products.manage.eyebrow")}
        title={t("products.manage.title")}
        description={t("products.manage.description")}
        actions={
          <Button asChild>
            <Link to="/my-products/new">
              <PackagePlus />
              {t("products.manage.new")}
            </Link>
          </Button>
        }
      />

      <div className="mt-12">
        {productsQuery.isLoading ? (
          <LoadingState />
        ) : productsQuery.isError ? (
          <ErrorState onRetry={() => void productsQuery.refetch()} />
        ) : (
          <Tabs defaultValue="draft">
            <TabsList>
              {STATUSES.map((status) => (
                <TabsTrigger key={status} value={status}>
                  {t(`products.status.${status}`)} (
                  {products.filter((product) => product.status === status).length})
                </TabsTrigger>
              ))}
            </TabsList>
            {STATUSES.map((status) => {
              const rows = products.filter((product) => product.status === status);
              return (
                <TabsContent key={status} value={status} className="mt-8">
                  {rows.length === 0 ? (
                    <EmptyState
                      title={t("products.manage.emptyTitle")}
                      description={t("products.manage.emptyDescription")}
                    />
                  ) : (
                    <ul className="space-y-4">
                      {rows.map((product) => (
                        <li key={product.id}>
                          <Card>
                            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                              <div className="space-y-1">
                                <p className="eyebrow">
                                  {product.brands?.name ?? t("products.fields.brandUnknown")}
                                </p>
                                <p className="font-display text-2xl leading-tight">
                                  {product.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {t("products.manage.imageCount", {
                                    count: product.product_images?.length ?? 0,
                                  })}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="outline">{t(`products.status.${status}`)}</Badge>
                                <Button asChild variant="outline" size="sm">
                                  <Link
                                    to="/my-products/$productId"
                                    params={{ productId: product.id }}
                                  >
                                    {t("products.manage.edit")}
                                  </Link>
                                </Button>
                                {status === "draft" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      statusMutation.mutate({
                                        id: product.id,
                                        status: "archived",
                                      })
                                    }
                                  >
                                    {t("products.manage.archive")}
                                  </Button>
                                ) : null}
                                {status === "archived" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      statusMutation.mutate({ id: product.id, status: "draft" })
                                    }
                                  >
                                    {t("products.manage.restore")}
                                  </Button>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </PageContainer>
  );
}
