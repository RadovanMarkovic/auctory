# Auctory AI Assistant (bilingual, read-only)

A minimal LangChain.js assistant that answers questions about Auctory listings and rules, in the language the user writes in. Informational only — it can never bid, confirm, or change anything.

## What the user gets

- A floating assistant button on every page (signed-in users), opening a chat panel.
- A full page at `/assistant` with the same chat, plus a sidebar of past conversations and a "New conversation" button.
- Both surfaces share one component set: conversation list, message list, composer, loading indicator, error state with Retry, and a Clear/dismiss error action.
- Answers arrive in Serbian or English matching the message the user typed; all UI labels come from the existing `en.json` / `sr.json` files.
- Every recommendation or value-related answer ends with a short informational disclaimer.

## What the assistant can look up

Four read-only tools, all fed from authoritative database rows through the existing public/safe read paths:

1. `searchActiveAuctions` — live and upcoming auctions by free text, category, brand, optional max budget.
2. `getAuctionDetails` — public details of one auction (current price, bid count, timing, product info).
3. `getProductPassport` — public certificate/passport data for one product.
4. `explainPlatformRules` — answers from a short, server-maintained EN/SR rules text covering auctions, wallets, confirmations and certificates.

Never surfaced: reserve prices, seller emails or private profile data, bidder identities, admin data, private certificate fields, internal error text.

## Hard limits

- Sign-in required; 2,000-character input cap; per-user rate limit (20 messages / 10 minutes); model call timeout (~30s) with a graceful localized fallback message.
- The system prompt forbids bidding, confirming transactions, editing products or auctions, transferring certificates, changing roles, and any claim that a physical item is authentic.
- No embeddings, vector store, web browsing, voice, uploads, admin analytics or autonomous actions.

## Technical section

**Migration** (one call, standard four-step order):

- `ai_conversations`: `id`, `user_id` (auth user), `title`, `created_at`, `updated_at` + updated_at trigger.
- `ai_messages`: `id`, `conversation_id` (FK cascade), `role` (`user` | `assistant` enum-checked text), `content`, `language` (`en` | `sr`), `created_at`.
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` on `ai_conversations` to `authenticated`; `SELECT` on `ai_messages` to `authenticated`; `ALL` on both to `service_role`. No `anon` grants.
- RLS: owners read/manage only their own conversations; messages readable when the parent conversation belongs to `auth.uid()`. No client INSERT/UPDATE/DELETE policy on `ai_messages` — all writes go through service-role server logic.

**Server-only agent** — `src/lib/assistant.server.ts`:

- Reads `OPENAI_API_KEY` inside the handler only; never returned, never logged.
- LangChain.js (`@langchain/openai`, `@langchain/core`, `langchain`) tool-calling agent with the four tools above; tool bodies query through the request-scoped authenticated Supabase client / existing public views so RLS still applies.
- Language detection from the user message (Serbian markers + Latin/Cyrillic heuristics), passed into the system prompt.
- Timeout wrapper and a typed error map; failures return a localized fallback string, not raw errors.

**Server functions** — `src/lib/assistant.functions.ts`, all `.middleware([requireSupabaseAuth])`, dynamic-importing the `.server` module inside handlers:

- `listConversations`, `getConversation(conversationId)`, `createConversation`, `deleteConversation`.
- `sendAssistantMessage({ conversationId?, content })` — validates length, applies the rate limit, persists the user message, runs the agent, persists the assistant reply via `supabaseAdmin`, returns both rows.

**UI** — `src/components/assistant/` (`AssistantChat`, `MessageList`, `MessageBubble`, `Composer`, `ConversationList`, `AssistantLauncher`), consumed by a floating launcher mounted in `AppShell` and by the new `src/routes/_authenticated/assistant.tsx` route (own `head()` metadata). Account menu gains an "Assistant" entry. New `assistant.*` i18n keys in both locale files.

**Tests** (`src/lib/assistant/assistant.test.ts`): conversation ownership/RLS shape, protected server access (unauthenticated rejected), language selection EN vs SR, tool selection for search vs rules questions, reserve-price refusal, bid/transaction-action refusal, graceful model-failure fallback.

**Secret:** `OPENAI_API_KEY` — already configured in the backend, no new secret needed.

**Verification:** `bunx vitest run`, `bunx tsgo --noEmit`, production build.

**Manual checklist:** ask in Serbian → Serbian reply; ask in English → English reply; "show me watches under 5000 EUR" → uses search tool with real lots; ask for an auction's reserve price → refused; ask it to place a bid → refused with explanation; open `/assistant`, start a new conversation, reload and confirm history persists; sign out and confirm the launcher and route are unavailable.
