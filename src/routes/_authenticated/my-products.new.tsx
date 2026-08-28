import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  ProductForm,
  emptyProductForm,
  toProductPayload,
  type ProductFormValues,
} from "@/components/products/ProductForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const title = "New Product — Auctory";
const description = "Create a new private Auctory listing and save it as a draft.";

export const Route = createFileRoute("/_authenticated/my-products/new")({
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
  component: NewProductPage,
});

function NewProductPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!user?.id) throw new Error("Missing authenticated user");
      const { data, error } = await supabase
        .from("products")
        .insert({ ...toProductPayload(values), seller_id: user.id, status: "draft" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success(t("products.form.draftSaved"));
      void queryClient.invalidateQueries({ queryKey: ["my-products", user?.id] });
      void navigate({ to: "/my-products/$productId", params: { productId: id } });
    },
    onError: () => toast.error(t("products.form.saveFailed")),
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("products.manage.eyebrow")}
        title={t("products.form.newTitle")}
        description={t("products.form.newDescription")}
      />
      <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t("products.disclaimer")}
      </p>
      <div className="mt-10">
        <ProductForm
          initialValues={emptyProductForm}
          submitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          provenanceSlot={
            <div className="space-y-2 border-t border-border pt-6">
              <Label>{t("products.attachment.label")}</Label>
              <p className="text-sm text-muted-foreground">{t("products.attachment.hint")}</p>
              <p className="text-sm text-muted-foreground">
                {t("products.form.lockedUntilSaved")}
              </p>
              <Button type="button" variant="secondary" disabled>
                <Paperclip />
                {t("products.attachment.add")}
              </Button>
            </div>
          }
          footerSlot={
            <Card>
              <CardHeader>
                <CardTitle>{t("products.images.title")}</CardTitle>
                <CardDescription>{t("products.images.hint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("products.form.lockedUntilSaved")}
                </p>
                <Button type="button" variant="secondary" disabled>
                  <ImagePlus />
                  {t("products.images.add")}
                </Button>
              </CardContent>
            </Card>
          }
        />
      </div>
    </PageContainer>
  );
}
