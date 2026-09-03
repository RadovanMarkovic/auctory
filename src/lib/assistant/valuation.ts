/**
 * Deterministic, dependency-free valuation math for the assistant.
 *
 * The language model NEVER produces these numbers: the range is computed here
 * from final prices of genuinely sold Auctory auctions and only explained by
 * the model afterwards. No bidder, winner, reserve or transaction data is used.
 */

import { assistantStrings, type AssistantLanguage } from "@/lib/assistant/core";

export const VALUATION_CURRENCY = "EUR";
export const MIN_COMPARABLES = 3;
export const MAX_COMPARABLES = 20;
export const YEAR_TOLERANCE = 5;

export interface ComparableSale {
  auctionId: string;
  finalPrice: number;
  currency: string;
  categoryId: string | null;
  brandId: string | null;
  brandName: string | null;
  model: string | null;
  condition: string | null;
  productionYear: number | null;
}

export interface ValuationTarget {
  categoryId?: string | null;
  brandId?: string | null;
  brandName?: string | null;
  model?: string | null;
  condition?: string | null;
  productionYear?: number | null;
}

export type ValuationConfidence = "low" | "medium" | "high";

export interface ValuationResult {
  insufficientData: boolean;
  estimatedMin: number | null;
  estimatedMax: number | null;
  currency: string;
  comparableCount: number;
  confidence: ValuationConfidence;
  factors: string[];
  method: string;
  disclaimer: string;
}

const METHOD =
  "Comparables are genuinely sold Auctory auctions only (ended, with a winner, a final price, a finalization timestamp and a recorded transaction). " +
  "Candidates must share the product category; brand (+3), model (+3), identical condition (+2) and production year within 5 years (+1) add score. " +
  "The 20 highest-scoring comparables are kept, their final prices sorted, and the range is the 25th to 75th percentile (linear interpolation). " +
  "Fewer than 3 comparables returns insufficientData with no range. All prices are EUR; mixed currencies are never combined.";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Score a single comparable against the target. Returns null when unusable. */
export function scoreComparable(sale: ComparableSale, target: ValuationTarget): number | null {
  if (!Number.isFinite(sale.finalPrice) || sale.finalPrice <= 0) return null;
  if (sale.currency !== VALUATION_CURRENCY) return null;
  if (target.categoryId && sale.categoryId !== target.categoryId) return null;

  let score = 1;
  if (target.brandId && sale.brandId === target.brandId) score += 3;
  else if (target.brandName && norm(sale.brandName) === norm(target.brandName)) score += 3;
  if (target.model && norm(sale.model) === norm(target.model)) score += 3;
  if (target.condition && norm(sale.condition) === norm(target.condition)) score += 2;
  if (
    target.productionYear != null &&
    sale.productionYear != null &&
    Math.abs(sale.productionYear - target.productionYear) <= YEAR_TOLERANCE
  ) {
    score += 1;
  }
  return score;
}

/** Percentile of a sorted ascending list, linear interpolation. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low]!;
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildFactors(
  target: ValuationTarget,
  kept: { sale: ComparableSale; score: number }[],
  language: AssistantLanguage,
): string[] {
  const sr = language === "sr";
  const factors: string[] = [];
  factors.push(
    sr
      ? `${kept.length} prodatih aukcija u istoj kategoriji`
      : `${kept.length} sold auctions in the same category`,
  );
  const brandMatches = kept.filter(
    (k) =>
      (target.brandId && k.sale.brandId === target.brandId) ||
      (target.brandName && norm(k.sale.brandName) === norm(target.brandName)),
  ).length;
  if (brandMatches > 0) {
    factors.push(sr ? `${brandMatches} istog brenda` : `${brandMatches} of the same brand`);
  }
  const modelMatches = target.model
    ? kept.filter((k) => norm(k.sale.model) === norm(target.model)).length
    : 0;
  if (modelMatches > 0) {
    factors.push(sr ? `${modelMatches} istog modela` : `${modelMatches} of the same model`);
  }
  const conditionMatches = target.condition
    ? kept.filter((k) => norm(k.sale.condition) === norm(target.condition)).length
    : 0;
  if (conditionMatches > 0) {
    factors.push(
      sr ? `${conditionMatches} u istom stanju` : `${conditionMatches} in the same condition`,
    );
  }
  return factors;
}

function confidenceFor(count: number, strongMatches: number): ValuationConfidence {
  if (count >= 10 && strongMatches >= 5) return "high";
  if (count >= 5 || strongMatches >= 3) return "medium";
  return "low";
}

export function estimateValue(
  sales: ComparableSale[],
  target: ValuationTarget,
  language: AssistantLanguage,
): ValuationResult {
  const disclaimer =
    language === "sr"
      ? "Procena je informativna, zasnovana isključivo na prodatim Auctory aukcijama. Nije profesionalna procena vrednosti i ne garantuje prodajnu cenu."
      : "This estimate is informational and based only on completed Auctory sales. It is not a professional valuation and does not guarantee a sale price.";

  const scored = sales
    .map((sale) => ({ sale, score: scoreComparable(sale, target) }))
    .filter((entry): entry is { sale: ComparableSale; score: number } => entry.score != null)
    // Deterministic ordering: score desc, then price asc, then id.
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.sale.finalPrice - b.sale.finalPrice ||
        a.sale.auctionId.localeCompare(b.sale.auctionId),
    )
    .slice(0, MAX_COMPARABLES);

  if (scored.length < MIN_COMPARABLES) {
    return {
      insufficientData: true,
      estimatedMin: null,
      estimatedMax: null,
      currency: VALUATION_CURRENCY,
      comparableCount: scored.length,
      confidence: "low",
      factors:
        language === "sr"
          ? ["Nema dovoljno uporedivih prodatih aukcija na Auctory platformi."]
          : ["Not enough comparable completed Auctory sales."],
      method: METHOD,
      disclaimer,
    };
  }

  const prices = scored.map((entry) => entry.sale.finalPrice).sort((a, b) => a - b);
  const strongMatches = scored.filter((entry) => entry.score >= 4).length;

  return {
    insufficientData: false,
    estimatedMin: round(percentile(prices, 0.25)),
    estimatedMax: round(percentile(prices, 0.75)),
    currency: VALUATION_CURRENCY,
    comparableCount: scored.length,
    confidence: confidenceFor(scored.length, strongMatches),
    factors: buildFactors(target, scored, language),
    method: METHOD,
    disclaimer,
  };
}

/** Kept for tests/readability: the shared value disclaimer of the assistant. */
export function valueDisclaimer(language: AssistantLanguage): string {
  return assistantStrings(language).disclaimer;
}
