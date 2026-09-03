import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, ExternalLink, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  certificateErrorKey,
  explorerAddressUrl,
  explorerTokenUrl,
  explorerTxUrl,
  useCertificate,
  useRefreshCertificateOwner,
  useVerifyCertificate,
  type CertificateRow,
} from "@/lib/certificates";
import { useAuth } from "@/lib/auth-context";
import { usePublicTransfer } from "@/lib/transfers";
import { shortenAddress } from "@/lib/wallet/message";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs break-all sm:text-sm">{children}</span>
    </div>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="inline-flex items-center gap-1 underline underline-offset-4"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

type VerifyResult = {
  verified: boolean;
  manifestMatchesDatabase: boolean;
  manifestMatchesChain: boolean;
  ownerChanged: boolean;
};

/** Public digital passport for a minted product certificate. */
export function ProductPassport({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useCertificate(productId);
  const { data: transfer } = usePublicTransfer(productId);
  const verify = useVerifyCertificate(productId);
  const refresh = useRefreshCertificateOwner(productId);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (isLoading) return null;
  const certificate = data as CertificateRow | null;
  if (!certificate || certificate.status !== "minted") return null;

  const runVerify = () => {
    setErrorKey(null);
    verify.mutate(undefined, {
      onSuccess: (value) => setResult(value as VerifyResult),
      onError: (error) => {
        setResult(null);
        setErrorKey(certificateErrorKey(error));
      },
    });
  };

  const verifyMessage = () => {
    if (!result) return null;
    if (result.verified && !result.ownerChanged) return t("certificates.verify.ok");
    if (!result.manifestMatchesDatabase) return t("certificates.verify.manifestMismatch");
    if (!result.manifestMatchesChain) return t("certificates.verify.chainMismatch");
    return t("certificates.verify.ownerChanged");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BadgeCheck className="size-5" aria-hidden />
          {t("certificates.passport.title")}
        </CardTitle>
        <Badge variant="success">{t("certificates.status.minted")}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("certificates.passport.disclaimer")}</p>
        <Separator />
        <div className="divide-y divide-border">
          <Row label={t("certificates.fields.network")}>{certificate.network}</Row>
          {certificate.contract_address ? (
            <Row label={t("certificates.fields.contract")}>
              <Ext href={explorerAddressUrl(certificate.contract_address)}>
                {shortenAddress(certificate.contract_address)}
              </Ext>
            </Row>
          ) : null}
          {certificate.token_id ? (
            <Row label={t("certificates.fields.tokenId")}>
              {certificate.contract_address ? (
                <Ext href={explorerTokenUrl(certificate.contract_address, certificate.token_id)}>
                  #{certificate.token_id}
                </Ext>
              ) : (
                `#${certificate.token_id}`
              )}
            </Row>
          ) : null}
          {certificate.metadata_hash ? (
            <Row label={t("certificates.fields.metadataHash")}>{certificate.metadata_hash}</Row>
          ) : null}
          {certificate.metadata_uri ? (
            <Row label={t("certificates.fields.metadataUri")}>
              <Ext href={certificate.metadata_uri}>{t("certificates.fields.openMetadata")}</Ext>
            </Row>
          ) : null}
          {certificate.mint_tx_hash ? (
            <Row label={t("certificates.fields.mintTx")}>
              <Ext href={explorerTxUrl(certificate.mint_tx_hash)}>
                {shortenAddress(certificate.mint_tx_hash)}
              </Ext>
            </Row>
          ) : null}
          {certificate.mint_block_number ? (
            <Row label={t("certificates.fields.block")}>{certificate.mint_block_number}</Row>
          ) : null}
          {certificate.minted_at ? (
            <Row label={t("certificates.fields.registeredAt")}>
              {new Date(certificate.minted_at).toLocaleString()}
            </Row>
          ) : null}
          {certificate.seller_wallet ? (
            <Row label={t("certificates.fields.registeredSeller")}>
              <Ext href={explorerAddressUrl(certificate.seller_wallet)}>
                {shortenAddress(certificate.seller_wallet)}
              </Ext>
            </Row>
          ) : null}
          {certificate.current_owner_wallet ? (
            <Row label={t("certificates.fields.currentOwner")}>
              <Ext href={explorerAddressUrl(certificate.current_owner_wallet)}>
                {shortenAddress(certificate.current_owner_wallet)}
              </Ext>
            </Row>
          ) : null}
        </div>

        {transfer ? (
          <div className="rounded-md border border-border p-4">
            <p className="text-sm font-medium">{t("transfers.passport.title")}</p>
            <div className="mt-2 divide-y divide-border">
              <Row label={t("transfers.fields.previousOwner")}>
                <Ext href={explorerAddressUrl(transfer.previous_owner_wallet)}>
                  {shortenAddress(transfer.previous_owner_wallet)}
                </Ext>
              </Row>
              <Row label={t("transfers.fields.newOwner")}>
                <Ext href={explorerAddressUrl(transfer.buyer_wallet)}>
                  {shortenAddress(transfer.buyer_wallet)}
                </Ext>
              </Row>
              {transfer.tx_hash ? (
                <Row label={t("transfers.fields.txHash")}>
                  <Ext href={explorerTxUrl(transfer.tx_hash)}>
                    {shortenAddress(transfer.tx_hash)}
                  </Ext>
                </Row>
              ) : null}
              {transfer.block_number ? (
                <Row label={t("transfers.fields.block")}>{transfer.block_number}</Row>
              ) : null}
              {transfer.completed_at ? (
                <Row label={t("transfers.fields.completedAt")}>
                  {new Date(transfer.completed_at).toLocaleString()}
                </Row>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={runVerify} disabled={verify.isPending}>
            <ShieldCheck className="size-4" aria-hidden />
            {verify.isPending ? t("certificates.verify.running") : t("certificates.verify.action")}
          </Button>
          {user ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              <RefreshCw className="size-4" aria-hidden />
              {t("certificates.verify.refreshOwner")}
            </Button>
          ) : null}
        </div>

        {result ? (
          <p
            className={`flex items-center gap-2 text-sm ${
              result.verified && !result.ownerChanged ? "text-foreground" : "text-destructive"
            }`}
          >
            {result.verified && !result.ownerChanged ? (
              <ShieldCheck className="size-4" aria-hidden />
            ) : (
              <ShieldAlert className="size-4" aria-hidden />
            )}
            {verifyMessage()}
          </p>
        ) : null}
        {errorKey ? <p className="text-sm text-destructive">{t(errorKey)}</p> : null}

        {certificate.contract_address && certificate.token_id ? (
          <p className="text-xs text-muted-foreground">
            {t("certificates.passport.metamaskHint", {
              contract: certificate.contract_address,
              tokenId: certificate.token_id,
            })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
