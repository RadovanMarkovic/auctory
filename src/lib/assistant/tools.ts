/**
 * Read-only assistant tools. Each tool executes against a caller-provided
 * Supabase client, so existing RLS/public views decide what is visible.
 * No tool ever returns reserve prices, emails, bidder identities or private data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { assistantStrings, type AssistantLanguage } from "@/lib/assistant/core";
import {
  estimateValue,
  VALUATION_CURRENCY,
  type ComparableSale,
  type ValuationResult,
  type ValuationTarget,
} from "@/lib/assistant/valuation";

export interface AuctionToolItem {
  id: string;
  productId: string;
  title: string;
  model: string | null;
  brand: string | null;
  categoryEn: string | null;
  categorySr: string | null;
  condition: string | null;
  status: string;
  currentPrice: number;
  minimumNextBid: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  hasReserve: boolean;
  reserveMet: boolean;
}

export interface SearchAuctionsArgs {
  query?: string | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  maxBudget?: number | undefined;
}

/** eslint-disable-next-line @typescript-eslint/no-explicit-any */
type AnySupabase = SupabaseClient<Database, "public", any>;

async function joinProducts(
  supabase: AnySupabase,
  rows: Database["public"]["Views"]["public_auctions"]["Row"][],
): Promise<AuctionToolItem[]> {
  const productIds = Array.from(
    new Set(rows.map((r) => r.product_id).filter((v): v is string => Boolean(v))),
  );
  if (productIds.length === 0) return [];
  const { data: products } = await supabase
    .from("products")
    .select("id, title, model, condition, brands(name), categories(name_en, name_sr)")
    .in("id", productIds);
  type ProductJoin = {
    id: string;
    title: string;
    model: string | null;
    condition: string | null;
    brands: { name: string } | null;
    categories: { name_en: string; name_sr: string } | null;
  };
  const byId = new Map(((products ?? []) as unknown as ProductJoin[]).map((p) => [p.id, p]));
  return rows.flatMap((row) => {
    if (!row.id || !row.product_id) return [];
    const product = byId.get(row.product_id);
    if (!product) return [];
    return [
      {
        id: row.id,
        productId: row.product_id,
        title: product.title,
        model: product.model,
        brand: product.brands?.name ?? null,
        categoryEn: product.categories?.name_en ?? null,
        categorySr: product.categories?.name_sr ?? null,
        condition: product.condition,
        status: row.status ?? "live",
        currentPrice: Number(row.current_price ?? row.start_price ?? 0),
        minimumNextBid: Number(row.minimum_next_bid ?? row.start_price ?? 0),
        bidCount: row.bid_count ?? 0,
        startsAt: row.starts_at ?? "",
        endsAt: row.ends_at ?? "",
        hasReserve: Boolean(row.has_reserve),
        reserveMet: Boolean(row.reserve_met),
      } satisfies AuctionToolItem,
    ];
  });
}

/** Search live/upcoming public auctions by text, category, brand and budget. */
export async function searchActiveAuctions(
  supabase: AnySupabase,
  args: SearchAuctionsArgs,
): Promise<AuctionToolItem[]> {
  const { data, error } = await supabase
    .from("public_auctions")
    .select("*")
    .in("status", ["live", "scheduled"])
    .order("ends_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  let items = await joinProducts(supabase, data ?? []);

  if (args.maxBudget != null && Number.isFinite(args.maxBudget)) {
    items = items.filter((i) => i.minimumNextBid <= Number(args.maxBudget));
  }
  if (args.brand) {
    const needle = args.brand.toLowerCase();
    items = items.filter((i) => i.brand?.toLowerCase().includes(needle));
  }
  if (args.category) {
    const needle = args.category.toLowerCase();
    items = items.filter(
      (i) =>
        i.categoryEn?.toLowerCase().includes(needle) ||
        i.categorySr?.toLowerCase().includes(needle),
    );
  }
  if (args.query) {
    const needle = args.query.toLowerCase();
    items = items.filter((i) =>
      [i.title, i.model, i.brand, i.categoryEn, i.categorySr]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle)),
    );
  }
  return items.slice(0, 10);
}

/** Public details of one auction. Reserve amount is never included. */
export async function getAuctionDetails(
  supabase: AnySupabase,
  args: { auctionId: string },
): Promise<(AuctionToolItem & { sellerName: string | null; description: string | null }) | null> {
  const { data, error } = await supabase
    .from("public_auctions")
    .select("*")
    .eq("id", args.auctionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [item] = await joinProducts(supabase, [data]);
  if (!item) return null;

  let sellerName: string | null = null;
  if (data.seller_id) {
    const { data: seller } = await supabase.rpc("public_seller_summary", {
      _seller_id: data.seller_id,
    });
    sellerName = seller?.[0]?.full_name ?? null;
  }

  let description: string | null = null;
  const { data: product } = await supabase
    .from("products")
    .select("description")
    .eq("id", data.product_id!)
    .maybeSingle();
  description = (product?.description ?? null) as string | null;

  return { ...item, sellerName, description };
}

/** Safe public passport/certificate data for one product. */
export async function getProductPassport(
  supabase: AnySupabase,
  args: { productId: string },
): Promise<Record<string, unknown> | null> {
  const { data: cert, error } = await supabase
    .from("blockchain_certificates")
    .select("status, token_id, contract_address, network, mint_tx_hash, minted_at, current_owner_wallet, metadata_hash")
    .eq("product_id", args.productId)
    .maybeSingle();
  if (error) throw error;
  if (!cert) return null;

  const { data: transfer } = await supabase.rpc("public_certificate_transfer", {
    _product_id: args.productId,
  });

  return {
    status: cert.status,
    network: cert.network,
    contractAddress: cert.contract_address,
    tokenId: cert.token_id,
    mintTxHash: cert.mint_tx_hash,
    mintedAt: cert.minted_at,
    currentOwnerWallet: cert.current_owner_wallet,
    metadataHash: cert.metadata_hash,
    lastOwnershipChange: transfer?.[0] ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Value estimate (deterministic; the model only explains the numbers)  */
/* ------------------------------------------------------------------ */

export interface EstimateArgs {
  productId?: string | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  model?: string | undefined;
  condition?: string | undefined;
  productionYear?: number | undefined;
}

interface ProductFacts {
  categoryId: string | null;
  brandId: string | null;
  brandName: string | null;
  model: string | null;
  condition: string | null;
  productionYear: number | null;
}

/**
 * Comparable sales = genuinely sold auctions only. `finalize_auctions()` sets
 * `final_price` + `finalized_at` + `winner_id` together, and only when a
 * highest bidder exists and the reserve was met, so `status = 'ended'` with a
 * non-null final price and finalization timestamp is exactly the sold set.
 * Unsold, cancelled and merely expired auctions are excluded, and no bidder,
 * winner, reserve or transaction data is read.
 */
async function loadSoldComparables(supabase: AnySupabase): Promise<ComparableSale[]> {
  const { data, error } = await supabase
    .from("public_auctions")
    .select("id, product_id, status, final_price, finalized_at")
    .eq("status", "ended")
    .not("final_price", "is", null)
    .not("finalized_at", "is", null)
    .order("finalized_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const rows = (data ?? []).filter((r) => r.id && r.product_id && Number(r.final_price) > 0);
  const productIds = Array.from(new Set(rows.map((r) => r.product_id as string)));
  if (productIds.length === 0) return [];

  const { data: products } = await supabase
    .from("products")
    .select("id, model, condition, production_year, category_id, brand_id, brands(name)")
    .in("id", productIds);
  type Row = {
    id: string;
    model: string | null;
    condition: string | null;
    production_year: number | null;
    category_id: string | null;
    brand_id: string | null;
    brands: { name: string } | null;
  };
  const byId = new Map(((products ?? []) as unknown as Row[]).map((p) => [p.id, p]));

  return rows.flatMap((row) => {
    const product = byId.get(row.product_id as string);
    if (!product) return [];
    return [
      {
        auctionId: row.id as string,
        finalPrice: Number(row.final_price),
        currency: VALUATION_CURRENCY,
        categoryId: product.category_id,
        brandId: product.brand_id,
        brandName: product.brands?.name ?? null,
        model: product.model,
        condition: product.condition,
        productionYear: product.production_year,
      } satisfies ComparableSale,
    ];
  });
}

async function resolveTarget(
  supabase: AnySupabase,
  args: EstimateArgs,
): Promise<ValuationTarget & { productTitle?: string | null }> {
  if (args.productId) {
    const { data } = await supabase
      .from("products")
      .select("id, title, model, condition, production_year, category_id, brand_id, brands(name)")
      .eq("id", args.productId)
      .maybeSingle();
    if (data) {
      const p = data as unknown as {
        title: string;
        model: string | null;
        condition: string | null;
        production_year: number | null;
        category_id: string | null;
        brand_id: string | null;
        brands: { name: string } | null;
      };
      return {
        categoryId: p.category_id,
        brandId: p.brand_id,
        brandName: p.brands?.name ?? null,
        model: p.model,
        condition: p.condition,
        productionYear: p.production_year,
        productTitle: p.title,
      };
    }
  }


  // Free-text criteria: resolve names to ids so scoring can match precisely.
  let categoryId: string | null = null;
  if (args.category) {
    const { data } = await supabase.from("categories").select("id, name_en, name_sr, slug");
    const needle = args.category.toLowerCase();
    categoryId =
      (data ?? []).find(
        (c: { id: string; name_en: string; name_sr: string; slug: string }) =>
          c.name_en.toLowerCase().includes(needle) ||
          c.name_sr.toLowerCase().includes(needle) ||
          c.slug.toLowerCase().includes(needle),
      )?.id ?? null;
  }
  let brandId: string | null = null;
  if (args.brand) {
    const { data } = await supabase.from("brands").select("id, name");
    const needle = args.brand.toLowerCase();
    brandId =
      (data ?? []).find((b: { id: string; name: string }) => b.name.toLowerCase().includes(needle))
        ?.id ?? null;
  }

  return {
    categoryId,
    brandId,
    brandName: args.brand ?? null,
    model: args.model ?? null,
    condition: args.condition ?? null,
    productionYear: args.productionYear ?? null,
  };
}

export async function estimateProductValue(
  supabase: AnySupabase,
  args: EstimateArgs,
  language: AssistantLanguage,
): Promise<ValuationResult & { basis: string }> {
  const target = await resolveTarget(supabase, args);
  const sales = await loadSoldComparables(supabase);
  const result = estimateValue(sales, target, language);
  return { ...result, basis: "completed Auctory sales only" };
}

/* ------------------------------------------------------------------ */
/* Recommendations                                                      */
/* ------------------------------------------------------------------ */

export interface RecommendArgs {
  maxBudget?: number | undefined;
  category?: string | undefined;
  brand?: string | undefined;
  query?: string | undefined;
}

export interface RecommendationResult {
  items: (AuctionToolItem & { reason: string })[];
  withinBudget: boolean;
  noExactMatches: boolean;
  disclaimer: string;
}

export async function recommendProducts(
  supabase: AnySupabase,
  args: RecommendArgs,
  language: AssistantLanguage,
): Promise<RecommendationResult> {
  const sr = language === "sr";
  const disclaimer = assistantStrings(language).disclaimer;

  const base: SearchAuctionsArgs = {};
  if (args.query) base.query = args.query;
  if (args.category) base.category = args.category;
  if (args.brand) base.brand = args.brand;

  const budgeted =
    args.maxBudget != null
      ? await searchActiveAuctions(supabase, { ...base, maxBudget: args.maxBudget })
      : await searchActiveAuctions(supabase, base);

  let pool = budgeted;
  let noExactMatches = false;
  let withinBudget = true;

  if (pool.length === 0) {
    // No match within the stated budget/criteria: say so explicitly and only
    // then widen the search.
    noExactMatches = true;
    withinBudget = false;
    pool = await searchActiveAuctions(supabase, base);
    if (pool.length === 0) pool = await searchActiveAuctions(supabase, {});
  }

  const ranked = pool
    .filter((item) => item.status === "live" || item.status === "scheduled")
    .sort((a, b) => {
      const endA = Date.parse(a.endsAt) || Number.MAX_SAFE_INTEGER;
      const endB = Date.parse(b.endsAt) || Number.MAX_SAFE_INTEGER;
      return endA - endB || a.id.localeCompare(b.id);
    })
    .slice(0, 5);

  const items = ranked.map((item) => {
    const bits: string[] = [];
    if (args.brand && item.brand) bits.push(sr ? `brend ${item.brand}` : `brand ${item.brand}`);
    if (args.category) {
      const name = sr ? item.categorySr : item.categoryEn;
      if (name) bits.push(sr ? `kategorija ${name}` : `category ${name}`);
    }
    if (args.maxBudget != null && item.minimumNextBid <= args.maxBudget) {
      bits.push(sr ? "u okviru budžeta" : "within budget");
    } else if (args.maxBudget != null) {
      bits.push(sr ? "iznad navedenog budžeta" : "above the stated budget");
    }
    bits.push(
      sr
        ? `trenutna cena ${item.currentPrice} EUR, ${item.bidCount} ponuda`
        : `current price ${item.currentPrice} EUR, ${item.bidCount} bids`,
    );
    return { ...item, reason: bits.join(", ") };
  });

  return { items, withinBudget, noExactMatches, disclaimer };
}

export type ToolName =
  | "searchActiveAuctions"
  | "getAuctionDetails"
  | "getProductPassport"
  | "estimateProductValue"
  | "recommendProducts";

export async function executeTool(
  supabase: AnySupabase,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name as ToolName | "explainPlatformRules") {
    case "searchActiveAuctions": {
      const parsed: SearchAuctionsArgs = {};
      const q = args["query"];
      const c = args["category"];
      const b = args["brand"];
      const m = args["maxBudget"];
      if (typeof q === "string") parsed.query = q.slice(0, 200);
      if (typeof c === "string") parsed.category = c.slice(0, 100);
      if (typeof b === "string") parsed.brand = b.slice(0, 100);
      if (typeof m === "number" && Number.isFinite(m)) parsed.maxBudget = m;
      return searchActiveAuctions(supabase, parsed);
    }
    case "getAuctionDetails": {
      const id = args["auctionId"];
      if (typeof id !== "string") return { error: "missing auctionId" };
      return getAuctionDetails(supabase, { auctionId: id.slice(0, 64) });
    }
    case "getProductPassport": {
      const id = args["productId"];
      if (typeof id !== "string") return { error: "missing productId" };
      return getProductPassport(supabase, { productId: id.slice(0, 64) });
    }
    default:
      return { error: "unknown tool" };
  }
}

/** OpenAI tool schemas — explainPlatformRules needs no database access. */
export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "searchActiveAuctions",
      description:
        "Search currently live or upcoming public auctions by free text, category, brand and optional maximum budget (next minimum bid).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free text, e.g. 'Rolex Submariner'" },
          category: { type: "string", description: "Category name, e.g. 'watches'" },
          brand: { type: "string", description: "Brand name" },
          maxBudget: { type: "number", description: "Maximum next minimum bid in EUR" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getAuctionDetails",
      description: "Get public details of a single auction by its id.",
      parameters: {
        type: "object",
        properties: { auctionId: { type: "string" } },
        required: ["auctionId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getProductPassport",
      description: "Get the public digital passport / certificate data of a product by its id.",
      parameters: {
        type: "object",
        properties: { productId: { type: "string" } },
        required: ["productId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "explainPlatformRules",
      description:
        "Answer questions about how Auctory works: auctions, bidding, wallets, confirmations, certificates.",
      parameters: { type: "object", properties: {} },
    },
  },
];
