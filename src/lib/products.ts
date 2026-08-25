import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProductStatus = Database["public"]["Enums"]["product_status"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Stable condition keys; labels are translated via `products.conditions.<key>`. */
export const PRODUCT_CONDITIONS = [
  "new",
  "unworn",
  "excellent",
  "very_good",
  "good",
  "fair",
  "restored",
] as const;

export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export function categoryName(category: Pick<CategoryRow, "name_en" | "name_sr">, language: string) {
  return language.startsWith("sr") ? category.name_sr : category.name_en;
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BrandRow[]> => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Resolves storage paths to temporary signed URLs (the bucket is private). */
export function useSignedImageUrls(paths: string[]) {
  const key = [...paths].sort().join("|");
  return useQuery({
    queryKey: ["product-image-urls", key],
    enabled: paths.length > 0,
    staleTime: 45 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const unique = Array.from(new Set(paths));
      if (unique.length === 0) return {};
      const { data, error } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .createSignedUrls(unique, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      }
      return map;
    },
  });
}
