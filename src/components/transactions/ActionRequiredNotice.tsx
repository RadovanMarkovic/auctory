import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { usePendingTransactions } from "@/lib/transactions";

/** In-app "Action required" notice for transactions awaiting the user's confirmation. */
export function ActionRequiredNotice() {
  const { t } = useTranslation();
  const { pending } = usePendingTransactions();

  if (pending.length === 0) return null;
  const first = pending[0]!;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{t("transactions.actionRequired.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("transactions.actionRequired.description", { count: pending.length })}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="gold">
          <Link to="/transactions/$transactionId" params={{ transactionId: first.id }}>
            {t("transactions.actionRequired.open")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
