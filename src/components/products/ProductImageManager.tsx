import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  PRODUCT_IMAGES_BUCKET,
  useSignedImageUrls,
  type ProductImageRow,
} from "@/lib/products";

export function ProductImageManager({
  productId,
  sellerId,
  images,
}: {
  productId: string;
  sellerId: string;
  images: ProductImageRow[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const urlsQuery = useSignedImageUrls(images.map((image) => image.storage_path));
  const urls = urlsQuery.data ?? {};

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["seller-product", productId] });
  }

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      let order = images.length;
      let hasCover = images.some((image) => image.is_cover);
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error("type");
        if (file.size > 10 * 1024 * 1024) throw new Error("size");
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${sellerId}/${productId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { error } = await supabase.from("product_images").insert({
          product_id: productId,
          storage_path: path,
          is_cover: !hasCover,
          sort_order: order,
        });
        if (error) throw error;
        hasCover = true;
        order += 1;
      }
    },
    onSuccess: () => {
      toast.success(t("products.images.uploaded"));
      invalidate();
    },
    onError: (error: Error) => {
      if (error.message === "type") toast.error(t("products.images.invalidType"));
      else if (error.message === "size") toast.error(t("products.images.tooLarge"));
      else toast.error(t("common.errorTitle"));
    },
    onSettled: () => setUploading(false),
  });

  const coverMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const current = images.find((image) => image.is_cover);
      if (current && current.id !== imageId) {
        const { error } = await supabase
          .from("product_images")
          .update({ is_cover: false })
          .eq("id", current.id);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("product_images")
        .update({ is_cover: true })
        .eq("id", imageId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("products.images.coverSet"));
      invalidate();
    },
    onError: () => toast.error(t("common.errorTitle")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (image: ProductImageRow) => {
      const { error } = await supabase.from("product_images").delete().eq("id", image.id);
      if (error) throw error;
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);
      if (image.is_cover) {
        const next = images.find((candidate) => candidate.id !== image.id);
        if (next) {
          await supabase.from("product_images").update({ is_cover: true }).eq("id", next.id);
        }
      }
    },
    onSuccess: () => {
      toast.success(t("products.images.deleted"));
      invalidate();
    },
    onError: () => toast.error(t("common.errorTitle")),
  });

  return (
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
            if (files.length === 0) return;
            setUploading(true);
            uploadMutation.mutate(files);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus />
          {t("products.images.add")}
        </Button>

        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("products.images.empty")}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-3">
            {images.map((image) => (
              <li key={image.id} className="overflow-hidden rounded-md border border-border">
                <div className="surface-gradient relative aspect-4/3">
                  {urls[image.storage_path] ? (
                    <img
                      src={urls[image.storage_path]}
                      alt={image.caption ?? t("products.images.alt")}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  {image.is_cover ? (
                    <Badge className="absolute top-2 left-2">{t("products.images.cover")}</Badge>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={image.is_cover}
                    onClick={() => coverMutation.mutate(image.id)}
                  >
                    <Star />
                    {t("products.images.makeCover")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t("products.images.delete")}
                    onClick={() => deleteMutation.mutate(image)}
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
  );
}
