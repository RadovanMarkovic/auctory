import { Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { shortenAddress } from "@/lib/wallet/message";
import { useWallet } from "@/lib/wallet/use-wallet";

/** Header wallet control: connect, wrong network, or connected account.
 * Disabled until the user is signed in. */
export function WalletButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const wallet = useWallet();
  const isAuthenticated = Boolean(session);

  async function handleClick() {
    if (!isAuthenticated) return;
    if (!wallet.available) {
      toast.error(t("wallet.errors.no_metamask"));
      return;
    }
    if (wallet.address && !wallet.onSepolia) {
      const ok = await wallet.switchNetwork();
      if (!ok && wallet.error) toast.error(t(`wallet.errors.${wallet.error}`));
      return;
    }
    if (wallet.address) return;
    const address = await wallet.connect();
    if (!address && wallet.error) toast.error(t(`wallet.errors.${wallet.error}`));
  }

  const label = !wallet.address
    ? t("wallet.connect")
    : !wallet.onSepolia
      ? t("wallet.wrongNetworkShort")
      : shortenAddress(wallet.address);

  return (
    <Button
      variant="outlineGold"
      size="sm"
      className={className}
      onClick={handleClick}
      disabled={wallet.connecting || !isAuthenticated}
      aria-disabled={!isAuthenticated}
    >
      <Wallet />
      {label}
    </Button>
  );
}
