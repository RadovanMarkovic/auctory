import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { isSepoliaVerified, useVerifiedWallet } from "@/lib/wallet/verify";

/**
 * Shown where a verified Sepolia wallet is a prerequisite
 * (seller publishing, buyer certificate transfer).
 */
export function WalletRequiredNotice({ context }: { context: "seller" | "buyer" }) {
  const { t } = useTranslation();
  const { data, isLoading } = useVerifiedWallet();

  if (isLoading || isSepoliaVerified(data)) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{t("wallet.required.title")}</p>
            <p className="text-sm text-muted-foreground">{t(`wallet.required.${context}`)}</p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/profile" hash="wallet">
            {t("wallet.required.action")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
