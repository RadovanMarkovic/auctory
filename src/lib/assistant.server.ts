/**
 * Server-only LangChain assistant. Reads OPENAI_API_KEY only inside handlers;
 * never returns or logs it. Runs a bounded tool-calling loop with a timeout.
 */

import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  appendDisclaimerIfValued,
  assistantStrings,
  buildSystemPrompt,
  detectLanguage,
  MODEL_TIMEOUT_MS,
  platformRules,
  type AssistantLanguage,
} from "@/lib/assistant/core";
import { executeTool, TOOL_SCHEMAS } from "@/lib/assistant/tools";

export class AssistantUnavailableError extends Error {
  readonly language: AssistantLanguage;
  constructor(language: AssistantLanguage, cause?: unknown) {
    super("assistant_unavailable");
    this.language = language;
    if (cause) this.cause = cause;
  }
}

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("assistant_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Runs the assistant for one user message. Returns the localized answer text.
 * Throws AssistantUnavailableError for any model/tool failure so the caller
 * can store a graceful fallback instead of an error trace.
 */
export async function runAssistant(
  supabase: SupabaseClient<Database, "public", never>,
  message: string,
  history: ChatHistoryTurn[],
  language: AssistantLanguage,
): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new AssistantUnavailableError(language, new Error("missing OPENAI_API_KEY"));

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.2,
    apiKey,
    timeout: MODEL_TIMEOUT_MS,
    maxTokens: 800,
  }).bindTools(TOOL_SCHEMAS);

  const messages: BaseMessage[] = [
    new SystemMessage(buildSystemPrompt(language, platformRules(language))),
    ...history.slice(-12).map((turn) =>
      turn.role === "user" ? new HumanMessage(turn.content) : new AIMessage(turn.content),
    ),
    new HumanMessage(message),
  ];

  const strings = assistantStrings(language);

  try {
    let response = (await withTimeout(model.invoke(messages), MODEL_TIMEOUT_MS)) as AIMessage;
    for (let step = 0; step < 4 && response.tool_calls?.length; step++) {
      messages.push(response);
      for (const call of response.tool_calls) {
        let result: unknown;
        if (call.name === "explainPlatformRules") {
          result = { rules: platformRules(language) };
        } else {
          try {
            result = await executeTool(
              supabase,
              call.name,
              (call.args ?? {}) as Record<string, unknown>,
            );
          } catch {
            result = { error: "tool_unavailable" };
          }
        }
        messages.push(
          new ToolMessage({
            tool_call_id: call.id ?? call.name,
            name: call.name,
            content: JSON.stringify(result ?? null),
          }),
        );
      }
      response = (await withTimeout(model.invoke(messages), MODEL_TIMEOUT_MS)) as AIMessage;
    }

    const text = typeof response.content === "string" ? response.content.trim() : "";
    if (!text) throw new Error("empty_model_response");
    return appendDisclaimerIfValued(text, language);
  } catch (error) {
    console.error("[assistant] model call failed:", error instanceof Error ? error.message : error);
    throw new AssistantUnavailableError(language, error);
  }
}

export function fallbackMessage(language: AssistantLanguage): string {
  return assistantStrings(language).modelFailure;
}

export { detectLanguage };
