import { Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

/** Placeholder: wallet connection (Sepolia) is not implemented yet. */
export function WalletButton({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <Button variant="outlineGold" size="sm" className={className} disabled>
      <Wallet />
      {t("wallet.connect")}
    </Button>
  );
}
