import { describe, expect, it } from "vitest";

import {
  appendDisclaimerIfValued,
  assistantStrings,
  buildSystemPrompt,
  detectLanguage,
  isActionRequest,
  isReservePriceRequest,
  MAX_INPUT_LENGTH,
  platformRules,
  RATE_LIMIT_MESSAGES,
} from "@/lib/assistant/core";
import {
  getAuctionDetails,
  getProductPassport,
  searchActiveAuctions,
  executeTool,
} from "@/lib/assistant/tools";

/* ---------- fake supabase (records calls, returns canned rows) ---------- */

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

function fakeSupabase(handlers: {
  public_auctions?: unknown[];
  products?: unknown[];
  blockchain_certificates?: unknown;
  rpc?: Record<string, unknown>;
}) {
  const calls: Call[] = [];
  class Builder implements PromiseLike<{ data: unknown; error: null }> {
    constructor(private table: string) {}
    private rows() {
      return this.table === "public_auctions"
        ? (handlers.public_auctions ?? [])
        : this.table === "products"
          ? (handlers.products ?? [])
          : [];
    }
    private record(method: string, args: unknown[]) {
      calls.push({ table: this.table, method, args });
      return this;
    }
    select(...a: unknown[]) { return this.record("select", a); }
    eq(...a: unknown[]) { return this.record("eq", a); }
    in(...a: unknown[]) { return this.record("in", a); }
    order(...a: unknown[]) { return this.record("order", a); }
    limit(...a: unknown[]) { return this.record("limit", a); }
    then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
      onfulfilled?: ((v: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve({ data: this.rows(), error: null as null }).then(onfulfilled, onrejected);
    }
    maybeSingle() {
      const row =
        this.table === "blockchain_certificates"
          ? (handlers.blockchain_certificates ?? null)
          : (this.rows()[0] ?? null);
      calls.push({ table: this.table, method: "maybeSingle", args: [] });
      return Promise.resolve({ data: row, error: null });
    }
  }
  return {
    calls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => new Builder(table) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc: (name: string) =>
      Promise.resolve({ data: handlers.rpc?.[name] ?? [], error: null }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const AUCTION_ROW = {
  id: "a1",
  product_id: "p1",
  seller_id: "s1",
  status: "live",
  current_price: 1200,
  minimum_next_bid: 1250,
  start_price: 1000,
  bid_count: 3,
  starts_at: "2026-09-01T00:00:00Z",
  ends_at: "2026-09-10T00:00:00Z",
  has_reserve: true,
  reserve_met: false,
};

const PRODUCT_ROW = {
  id: "p1",
  title: "Rolex Submariner",
  model: "116610",
  condition: "excellent",
  brands: { name: "Rolex" },
  categories: { name_en: "Watches", name_sr: "Satovi" },
};

/* ---------- language detection ---------- */

describe("detectLanguage", () => {
  it("detects Serbian by diacritics and Cyrillic", () => {
    expect(detectLanguage("Koja je cena ovog sata?")).toBe("sr");
    expect(detectLanguage("Где је аукција?")).toBe("sr");
    expect(detectLanguage("Da li ima aukcija za satove?")).toBe("sr");
  });
  it("detects English otherwise", () => {
    expect(detectLanguage("What auctions are live right now?")).toBe("en");
  });
});

/* ---------- refusal classification ---------- */

describe("safety classification", () => {
  it("refuses reserve-price questions in both languages", () => {
    expect(isReservePriceRequest("What is the reserve price?")).toBe(true);
    expect(isReservePriceRequest("Koja je rezervna cena?")).toBe(true);
    expect(isReservePriceRequest("Which Rolex is live?")).toBe(false);
  });
  it("refuses state-changing action requests in both languages", () => {
    expect(isActionRequest("Place a bid of 2000 for me")).toBe(true);
    expect(isActionRequest("Ponudi 2000 na ovoj aukciji")).toBe(true);
    expect(isActionRequest("Confirm the transaction please")).toBe(true);
    expect(isActionRequest("Transfer the certificate to my wallet")).toBe(true);
    expect(isActionRequest("Cancel my auction")).toBe(true);
    expect(isActionRequest("How does bidding work?")).toBe(false);
  });
  it("refusal strings are localized", () => {
    expect(assistantStrings("sr").reserveRefusal).toContain("Rezervna cena");
    expect(assistantStrings("en").actionRefusal).toContain("informational");
  });
});

/* ---------- system prompt ---------- */

describe("buildSystemPrompt", () => {
  it("enforces Serbian answers for Serbian input and embeds rules", () => {
    const prompt = buildSystemPrompt("sr", platformRules("sr"));
    expect(prompt).toContain("Serbian");
    expect(prompt).toContain("NEVER reveal reserve prices");
    expect(prompt).toContain("off-chain");
    expect(prompt).not.toContain("OPENAI_API_KEY");
  });
  it("limits configuration constants", () => {
    expect(MAX_INPUT_LENGTH).toBe(2000);
    expect(RATE_LIMIT_MESSAGES).toBeGreaterThan(0);
  });
});

/* ---------- disclaimer ---------- */

describe("appendDisclaimerIfValued", () => {
  it("appends a disclaimer to value/recommendation answers", () => {
    const out = appendDisclaimerIfValued("I recommend this watch at that price.", "en");
    expect(out).toContain("not an appraisal");
  });
  it("leaves neutral answers untouched", () => {
    expect(appendDisclaimerIfValued("Three auctions end tomorrow.", "en")).toBe(
      "Three auctions end tomorrow.",
    );
  });
});

/* ---------- tools ---------- */

describe("assistant tools", () => {
  it("searchActiveAuctions reads only the public view and returns safe fields", async () => {
    const sb = fakeSupabase({ public_auctions: [AUCTION_ROW], products: [PRODUCT_ROW] });
    const items = await searchActiveAuctions(sb, {});
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item).not.toHaveProperty("reserve_price");
    expect(item).not.toHaveProperty("highest_bidder_id");
    expect(item.title).toBe("Rolex Submariner");
    // only the public_auctions view is queried for auctions
    expect(sb.calls.filter((c: Call) => c.table === "auctions")).toHaveLength(0);
    expect(sb.calls.filter((c: Call) => c.table === "bids")).toHaveLength(0);
  });

  it("applies budget, brand and text filters", async () => {
    const sb = fakeSupabase({ public_auctions: [AUCTION_ROW], products: [PRODUCT_ROW] });
    expect(await searchActiveAuctions(sb, { maxBudget: 100 })).toHaveLength(0);
    expect(await searchActiveAuctions(sb, { maxBudget: 2000 })).toHaveLength(1);
    expect(await searchActiveAuctions(sb, { brand: "omega" })).toHaveLength(0);
    expect(await searchActiveAuctions(sb, { query: "submariner" })).toHaveLength(1);
  });

  it("getAuctionDetails uses public_seller_summary, never profiles", async () => {
    const sb = fakeSupabase({
      public_auctions: [AUCTION_ROW],
      products: [PRODUCT_ROW],
      rpc: { public_seller_summary: [{ full_name: "Milan", id: "s1", country: "RS", member_since: "" }] },
    });
    const detail = await getAuctionDetails(sb, { auctionId: "a1" });
    expect(detail?.sellerName).toBe("Milan");
    expect(detail).not.toHaveProperty("reserve_price");
    expect(sb.calls.filter((c: Call) => c.table === "profiles")).toHaveLength(0);
  });

  it("getProductPassport returns only safe certificate columns", async () => {
    const sb = fakeSupabase({
      blockchain_certificates: {
        status: "minted",
        token_id: "7",
        contract_address: "0xabc",
        network: "sepolia",
        mint_tx_hash: "0xtx",
        minted_at: "2026-09-01",
        current_owner_wallet: "0xseller",
        metadata_hash: "0xhash",
      },
    });
    const passport = await getProductPassport(sb, { productId: "p1" });
    expect(passport).toMatchObject({ status: "minted", tokenId: "7" });
    expect(passport).not.toHaveProperty("manifest");
    expect(passport).not.toHaveProperty("last_error_message");
  });

  it("executeTool truncates and validates arguments", async () => {
    const sb = fakeSupabase({ public_auctions: [], products: [] });
    const missing = await executeTool(sb, "getAuctionDetails", {});
    expect(missing).toEqual({ error: "missing auctionId" });
    const unknown = await executeTool(sb, "dropTable", {});
    expect(unknown).toEqual({ error: "unknown tool" });
  });
});
