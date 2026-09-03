import { ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAuctionDate } from "@/lib/auctions";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/certificates";
import {
  transferErrorKey,
  useOwnershipTransfer,
  useReconcileTransfer,
  useStartTransfer,
} from "@/lib/transfers";
import type { TransactionStatus } from "@/lib/transactions";
import { shortenAddress } from "@/lib/wallet/message";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs break-all sm:text-sm">{children}</span>
    </div>
  );
}

interface Props {
  transactionId: string;
  status: TransactionStatus;
  isParticipant: boolean;
  locale: string;
}

/** On-chain certificate transfer progress and protected actions. */
export function CertificateTransferPanel({
  transactionId,
  status,
  isParticipant,
  locale,
}: Props) {
  const { t } = useTranslation();
  const { data: transfer } = useOwnershipTransfer(transactionId);
  const start = useStartTransfer(transactionId);
  const reconcile = useReconcileTransfer(transactionId);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const relevant =
    status === "ready_for_transfer" ||
    status === "transferring_certificate" ||
    status === "completed" ||
    Boolean(transfer);
  if (!relevant) return null;

  const busy = start.isPending || reconcile.isPending;

  const stage =
    status === "completed" || transfer?.status === "completed"
      ? "completed"
      : transfer?.status === "submitted"
        ? "confirming"
        : status === "transferring_certificate"
          ? "submitting"
          : "ready";

  const run = (mutation: typeof start) => {
    setErrorKey(null);
    mutation.mutate(undefined, {
      onError: (error) => setErrorKey(transferErrorKey(error)),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 font-display text-2xl">
          <ShieldCheck className="size-5" aria-hidden />
          {t("transfers.title")}
        </CardTitle>
        <Badge variant={stage === "completed" ? "success" : "outline"}>
          {t(`transfers.stage.${stage}`)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("transfers.description")}</p>
        <Separator />

        <div className="divide-y divide-border">
          {transfer?.previous_owner_wallet ? (
            <Row label={t("transfers.fields.previousOwner")}>
              <a
                className="inline-flex items-center gap-1 underline underline-offset-4"
                href={explorerAddressUrl(transfer.previous_owner_wallet)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {shortenAddress(transfer.previous_owner_wallet)}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </Row>
          ) : null}
          {transfer?.buyer_wallet ? (
            <Row label={t("transfers.fields.newOwner")}>
              <a
                className="inline-flex items-center gap-1 underline underline-offset-4"
                href={explorerAddressUrl(transfer.buyer_wallet)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {shortenAddress(transfer.buyer_wallet)}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </Row>
          ) : null}
          {transfer?.tx_hash ? (
            <Row label={t("transfers.fields.txHash")}>
              <a
                className="inline-flex items-center gap-1 underline underline-offset-4"
                href={explorerTxUrl(transfer.tx_hash)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {shortenAddress(transfer.tx_hash)}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </Row>
          ) : null}
          {transfer?.block_number ? (
            <Row label={t("transfers.fields.block")}>{transfer.block_number}</Row>
          ) : null}
          {transfer?.completed_at ? (
            <Row label={t("transfers.fields.completedAt")}>
              {formatAuctionDate(transfer.completed_at, locale)}
            </Row>
          ) : null}
          {transfer?.retry_count ? (
            <Row label={t("transfers.fields.retries")}>{transfer.retry_count}</Row>
          ) : null}
        </div>

        {transfer?.last_error_code && stage !== "completed" ? (
          <p className="text-sm text-destructive">
            {t(`transfers.errors.${transfer.last_error_code}`, {
              defaultValue: t("transfers.errors.TRANSFER_FAILED"),
            })}
          </p>
        ) : null}
        {errorKey ? <p className="text-sm text-destructive">{t(errorKey)}</p> : null}

        {isParticipant && stage !== "completed" ? (
          <div className="flex flex-wrap gap-3">
            {status === "ready_for_transfer" ? (
              <Button variant="gold" disabled={busy} onClick={() => run(start)}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("transfers.actions.transfer")}
              </Button>
            ) : null}
            <Button variant="outline" disabled={busy} onClick={() => run(reconcile)}>
              <RefreshCw className="size-4" aria-hidden />
              {t("transfers.actions.reconcile")}
            </Button>
          </div>
        ) : null}

        {stage === "completed" ? (
          <p className="text-sm text-muted-foreground">{t("transfers.completedNotice")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
