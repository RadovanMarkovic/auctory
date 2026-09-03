import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletRequiredNotice } from "@/components/wallet/WalletRequiredNotice";
import { ProductPassport } from "@/components/certificates/ProductPassport";
import {
  certificateErrorKey,
  useCertificate,
  useRegisterCertificate,
} from "@/lib/certificates";
import { isConnectedVerifiedWallet, useVerifiedWallet } from "@/lib/wallet/verify";
import { useWallet } from "@/lib/wallet/use-wallet";

/** Seller-only certificate registration for a product. */
export function CertificatePanel({
  productId,
  canRegister,
}: {
  productId: string;
  canRegister: boolean;
}) {
  const { t } = useTranslation();
  const { data: certificate, isLoading } = useCertificate(productId);
  const register = useRegisterCertificate(productId);
  const wallet = useWallet();
  const verified = useVerifiedWallet();
  const walletReady = isConnectedVerifiedWallet(verified.data, wallet.address, wallet.onSepolia);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (isLoading) return null;
  if (certificate?.status === "minted") return <ProductPassport productId={productId} />;

  const status = certificate?.status ?? "none";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5" aria-hidden />
          {t("certificates.panel.title")}
        </CardTitle>
        <Badge variant={status === "failed" ? "destructive" : "muted"}>
          {t(`certificates.status.${status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("certificates.panel.description")}</p>
        <p className="text-sm text-muted-foreground">{t("certificates.panel.requirement")}</p>
        {!walletReady ? <WalletRequiredNotice context="seller" /> : null}
        {status === "failed" && certificate?.last_error_code ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" aria-hidden />
            {t(`certificates.errors.${certificate.last_error_code}`, {
              defaultValue: t("certificates.errors.MINT_FAILED"),
            })}
          </p>
        ) : null}
        {errorKey ? <p className="text-sm text-destructive">{t(errorKey)}</p> : null}
        <Button
          onClick={() => {
            setErrorKey(null);
            register.mutate(undefined, {
              onError: (error) => setErrorKey(certificateErrorKey(error)),
            });
          }}
          disabled={!canRegister || !walletReady || register.isPending || status === "minting"}
        >
          {register.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {status === "failed"
            ? t("certificates.panel.retry")
            : t("certificates.panel.action")}
        </Button>
        {!canRegister ? (
          <p className="text-xs text-muted-foreground">{t("certificates.panel.publishFirst")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
