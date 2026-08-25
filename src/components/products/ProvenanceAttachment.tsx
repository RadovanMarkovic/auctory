import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/products";

const MAX_SIZE = 10 * 1024 * 1024;

export function ProvenanceAttachment({
  productId,
  sellerId,
  path,
  name,
}: {
  productId: string;
  sellerId: string;
  path: string | null;
  name: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["seller-product", productId] });
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_SIZE) throw new Error("size");
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const storagePath = `${sellerId}/${productId}/provenance-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw uploadError;
      const { error } = await supabase
        .from("products")
        .update({ provenance_document_path: storagePath, provenance_document_name: file.name })
        .eq("id", productId);
      if (error) throw error;
      if (path) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
    },
    onSuccess: () => {
      toast.success(t("products.attachment.uploaded"));
      invalidate();
    },
    onError: (error: Error) =>
      toast.error(
        error.message === "size" ? t("products.attachment.tooLarge") : t("common.errorTitle"),
      ),
    onSettled: () => setBusy(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({ provenance_document_path: null, provenance_document_name: null })
        .eq("id", productId);
      if (error) throw error;
      if (path) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
    },
    onSuccess: () => {
      toast.success(t("products.attachment.deleted"));
      invalidate();
    },
    onError: () => toast.error(t("common.errorTitle")),
  });

  async function openAttachment() {
    if (!path) return;
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (error || !data) {
      toast.error(t("common.errorTitle"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <Label>{t("products.attachment.label")}</Label>
      <p className="text-sm text-muted-foreground">{t("products.attachment.hint")}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          uploadMutation.mutate(file);
        }}
      />
      {path ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
          <Paperclip className="size-4 text-muted-foreground" />
          <span className="text-sm">{name ?? t("products.attachment.label")}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void openAttachment()}>
            <Download />
            {t("products.attachment.open")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("products.attachment.remove")}
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 />
          </Button>
        </div>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip />
        {path ? t("products.attachment.replace") : t("products.attachment.add")}
      </Button>
    </div>
  );
}
