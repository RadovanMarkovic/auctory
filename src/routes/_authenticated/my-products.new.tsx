import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Paperclip, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/products";

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

interface StagedImage {
  id: string;
  file: File;
  url: string;
}

function NewProductPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<StagedImage[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);

  // Revoke object URLs when the page unmounts.
  useEffect(() => {
    return () => {
      staged.forEach((image) => URL.revokeObjectURL(image.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(files: File[]) {
    const accepted: StagedImage[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(t("products.images.invalidType"));
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("products.images.tooLarge"));
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
    }
    if (accepted.length === 0) return;
    setStaged((current) => [...current, ...accepted]);
    setCoverId((current) => current ?? accepted[0]!.id);
  }

  function removeImage(id: string) {
    setStaged((current) => {
      const target = current.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const next = current.filter((image) => image.id !== id);
      setCoverId((cover) => (cover === id ? (next[0]?.id ?? null) : cover));
      return next;
    });
  }

  const createMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!user?.id) throw new Error("Missing authenticated user");
      const { data, error } = await supabase
        .from("products")
        .insert({ ...toProductPayload(values), seller_id: user.id, status: "draft" })
        .select("id")
        .single();
      if (error) throw error;
      const productId = data.id;

      const ordered = [
        ...staged.filter((image) => image.id === coverId),
        ...staged.filter((image) => image.id !== coverId),
      ];
      let index = 0;
      for (const image of ordered) {
        const extension = image.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${user.id}/${productId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(path, image.file, { contentType: image.file.type });
        if (uploadError) throw uploadError;
        const { error: rowError } = await supabase.from("product_images").insert({
          product_id: productId,
          storage_path: path,
          is_cover: index === 0,
          sort_order: index,
        });
        if (rowError) throw rowError;
        index += 1;
      }

      return productId;
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
              <CardContent className="space-y-6">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (files.length > 0) addFiles(files);
                  }}
                />
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("products.images.stagedHint")}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={createMutation.isPending}
                    onClick={() => inputRef.current?.click()}
                  >
                    <ImagePlus />
                    {t("products.images.add")}
                  </Button>
                </div>

                {staged.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("products.images.empty")}</p>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-3">
                    {staged.map((image) => (
                      <li
                        key={image.id}
                        className="overflow-hidden rounded-md border border-border"
                      >
                        <div className="surface-gradient relative aspect-4/3">
                          <img
                            src={image.url}
                            alt={t("products.images.alt")}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {image.id === coverId ? (
                            <Badge className="absolute top-2 left-2">
                              {t("products.images.cover")}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={image.id === coverId}
                            onClick={() => setCoverId(image.id)}
                          >
                            <Star />
                            {t("products.images.makeCover")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={t("products.images.remove")}
                            onClick={() => removeImage(image.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          }
        />
      </div>
    </PageContainer>
  );
}
