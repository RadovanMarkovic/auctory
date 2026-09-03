import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateProductDescription } from "@/lib/assistant.functions";
import { useRoles } from "@/lib/use-roles";

export interface DescriptionDraftFacts {
  productId?: string;
  title?: string;
  category?: string;
  brand?: string;
  model?: string;
  productionYear?: number;
  condition?: string;
  material?: string;
  countryOfOrigin?: string;
  hasOriginalBox?: boolean;
  hasDocuments?: boolean;
  provenanceNotes?: string;
}

interface Draft {
  titleSuggestion: string;
  shortDescriptionSr: string;
  shortDescriptionEn: string;
  detailedDescriptionSr: string;
  detailedDescriptionEn: string;
  highlightedAttributes: string[];
}

/**
 * Seller-only helper. The generated text is a draft: it only reaches the form
 * when the seller explicitly accepts one of the variants, and saving stays a
 * separate action.
 */
export function DescriptionAssistant({
  facts,
  onAccept,
}: {
  facts: () => DescriptionDraftFacts;
  onAccept: (text: string) => void;
}) {
  const { t } = useTranslation();
  const { isSeller } = useRoles();
  const generate = useServerFn(generateProductDescription);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  if (!isSeller) return null;

  async function run() {
    setLoading(true);
    setError(false);
    try {
      const result = (await generate({ data: facts() })) as Draft;
      setDraft(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function update(key: keyof Draft, value: string) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={loading} onClick={() => void run()}>
          <Sparkles className="mr-2 size-4" aria-hidden />
          {loading ? t("products.ai.generating") : t("products.ai.generate")}
        </Button>
        {error ? (
          <span className="text-sm text-destructive">{t("products.ai.error")}</span>
        ) : null}
        {error ? (
          <Button type="button" variant="ghost" onClick={() => void run()}>
            {t("common.retry")}
          </Button>
        ) : null}
        {draft ? (
          <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
            {t("products.ai.dismiss")}
          </Button>
        ) : null}
      </div>

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("products.ai.draftTitle")}</CardTitle>
            <CardDescription>{t("products.ai.notice")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ai-title">{t("products.ai.titleSuggestion")}</Label>
              <Textarea
                id="ai-title"
                rows={2}
                value={draft.titleSuggestion}
                onChange={(event) => update("titleSuggestion", event.target.value)}
              />
            </div>

            {(
              [
                ["shortDescriptionSr", "products.ai.shortSr"],
                ["shortDescriptionEn", "products.ai.shortEn"],
                ["detailedDescriptionSr", "products.ai.detailedSr"],
                ["detailedDescriptionEn", "products.ai.detailedEn"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`ai-${key}`}>{t(label)}</Label>
                <Textarea
                  id={`ai-${key}`}
                  rows={key.startsWith("detailed") ? 6 : 3}
                  value={draft[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onAccept(draft[key])}
                >
                  {t("products.ai.use")}
                </Button>
              </div>
            ))}

            {draft.highlightedAttributes.length > 0 ? (
              <div className="space-y-2">
                <Label>{t("products.ai.highlights")}</Label>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {draft.highlightedAttributes.map((attribute) => (
                    <li key={attribute}>{attribute}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
