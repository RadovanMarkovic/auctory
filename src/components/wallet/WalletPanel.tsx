import { Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortenAddress, sameAddress } from "@/lib/wallet/message";
import { useWallet } from "@/lib/wallet/use-wallet";
import { isSepoliaVerified, useVerifiedWallet, useVerifyWallet, walletErrorKey } from "@/lib/wallet/verify";

/** Wallet status plus connect / verify / change actions. */
export function WalletPanel() {
  const { t, i18n } = useTranslation();
  const wallet = useWallet();
  const verifiedQuery = useVerifiedWallet();
  const verifyMutation = useVerifyWallet();

  const verified = verifiedQuery.data ?? null;
  const isVerified = isSepoliaVerified(verified);
  const mismatch = Boolean(
    wallet.address && verified?.address && !sameAddress(wallet.address, verified.address),
  );

  const dateFormatter = new Intl.DateTimeFormat(i18n.language === "sr" ? "sr-RS" : "en-GB", {
    dateStyle: "medium",
  });

  async function handleConnect() {
    const address = await wallet.connect();
    if (!address && wallet.error) toast.error(t(`wallet.errors.${wallet.error}`));
  }

  async function handleVerify() {
    if (!wallet.address) return;
    try {
      await verifyMutation.mutateAsync(wallet.address);
      toast.success(t("wallet.verifiedToast"));
    } catch (error) {
      toast.error(t(`wallet.errors.${walletErrorKey(error)}`));
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t("profilePage.wallet.status")}</span>
        <Badge variant={isVerified ? "success" : "muted"}>
          {isVerified ? t("wallet.verified") : t("wallet.notVerified")}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t("profilePage.wallet.address")}</span>
        <span className="font-mono text-xs">
          {verified?.address ? shortenAddress(verified.address) : t("profilePage.wallet.none")}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t("profilePage.wallet.network")}</span>
        <span>{verified?.network ?? t("profilePage.wallet.none")}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{t("profilePage.wallet.verifiedAt")}</span>
        <span>
          {verified?.verifiedAt
            ? dateFormatter.format(new Date(verified.verifiedAt))
            : t("profilePage.wallet.none")}
        </span>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        {wallet.available
          ? wallet.address
            ? t("wallet.connectedAccount", { address: shortenAddress(wallet.address) })
            : t("wallet.notConnectedHint")
          : t("wallet.errors.no_metamask")}
      </div>

      {mismatch ? (
        <p className="text-xs text-destructive">{t("wallet.mismatch")}</p>
      ) : null}
      {wallet.address && !wallet.onSepolia ? (
        <p className="text-xs text-destructive">{t("wallet.errors.wrong_network")}</p>
      ) : null}

      <div className="space-y-2">
        {!wallet.address ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleConnect}
            disabled={!wallet.available || wallet.connecting}
          >
            <Wallet />
            {t("wallet.connect")}
          </Button>
        ) : !wallet.onSepolia ? (
          <Button variant="outline" className="w-full" onClick={() => void wallet.switchNetwork()}>
            {t("wallet.switchNetwork")}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleVerify}
            disabled={verifyMutation.isPending}
          >
            {verifyMutation.isPending
              ? t("common.loading")
              : verified?.address
                ? t("wallet.changeVerified")
                : t("wallet.verify")}
          </Button>
        )}
        {wallet.address ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={wallet.disconnect}>
            {t("wallet.disconnect")}
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{t("wallet.securityHint")}</p>
    </div>
  );
}
