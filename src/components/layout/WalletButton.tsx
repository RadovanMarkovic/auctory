import { Wallet } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { shortenAddress, sameAddress } from "@/lib/wallet/message";
import { useWallet } from "@/lib/wallet/use-wallet";
import { useVerifiedWallet } from "@/lib/wallet/verify";

/** Header wallet control: connect, wrong network, or connected account.
 * Disabled until the user is signed in. */
export function WalletButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const wallet = useWallet();
  const verifiedQuery = useVerifiedWallet();
  const isAuthenticated = Boolean(session);
  const verifiedAddress = verifiedQuery.data?.address ?? null;
  const mismatch = Boolean(
    wallet.address && verifiedAddress && !sameAddress(wallet.address, verifiedAddress),
  );

  // Warn as soon as MetaMask switches to an account other than the verified one.
  useEffect(() => {
    if (mismatch) toast.warning(t("wallet.mismatch"));
  }, [mismatch, wallet.address, t]);

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
      : mismatch
        ? t("wallet.mismatchShort")
        : shortenAddress(wallet.address);

  return (
    <Button
      variant={mismatch ? "outline" : "outlineGold"}
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
