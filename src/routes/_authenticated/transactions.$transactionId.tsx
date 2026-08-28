import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ConfirmationDialog, ErrorState, LoadingState, PageHeader } from "@/components/common";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatAuctionDate, formatAuctionMoney } from "@/lib/auctions";
import { useAuth } from "@/lib/auth-context";
import {
  canOpenDispute,
  isTransactionOpen,
  useConfirmAsBuyer,
  useConfirmAsSeller,
  useOpenDispute,
  useTransaction,
} from "@/lib/transactions";

const title = "Transaction — Auctory";
const description = "Record buyer and seller confirmations for a completed Auctory auction.";

export const Route = createFileRoute("/_authenticated/transactions/$transactionId")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TransactionPage,
});

function TransactionPage() {
  const { transactionId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("sr") ? "sr-RS" : "en-GB";
  const { user } = useAuth();
  const query = useTransaction(transactionId);

  const confirmBuyer = useConfirmAsBuyer();
  const confirmSeller = useConfirmAsSeller();
  const dispute = useOpenDispute();

  const [buyerOpen, setBuyerOpen] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [buyerAck, setBuyerAck] = useState(false);
  const [sellerAck, setSellerAck] = useState(false);
  const [reason, setReason] = useState("");

  if (query.isLoading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (query.isError) {
    return (
      <PageContainer>
        <ErrorState onRetry={() => void query.refetch()} />
      </PageContainer>
    );
  }

  const transaction = query.data;
  if (!transaction) {
    return (
      <PageContainer>
        <ErrorState
          title={t("transactions.detail.notFoundTitle")}
          description={t("transactions.detail.notFoundDescription")}
        />
      </PageContainer>
    );
  }

  const isBuyer = user?.id === transaction.buyer_id;
  const isSeller = user?.id === transaction.seller_id;
  const open = isTransactionOpen(transaction.status);

  const timeline = [
    {
      key: "ended",
      label: t("transactions.timeline.auctionEnded"),
      at: transaction.created_at,
      done: true,
    },
    {
      key: "buyer",
      label: t("transactions.timeline.buyerConfirmed"),
      at: transaction.buyer_confirmed_at,
      done: Boolean(transaction.buyer_confirmed_at),
    },
    {
      key: "seller",
      label: t("transactions.timeline.sellerConfirmed"),
      at: transaction.seller_confirmed_at,
      done: Boolean(transaction.seller_confirmed_at),
    },
    {
      key: "ready",
      label: t("transactions.timeline.readyForTransfer"),
      at: null,
      done: transaction.status === "ready_for_transfer",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("transactions.detail.eyebrow")}
        title={transaction.products?.title ?? t("transactions.detail.title")}
        description={t("transactions.detail.description")}
        actions={
          <Button asChild variant="outline">
            <Link to="/transactions">{t("transactions.detail.backToList")}</Link>
          </Button>
        }
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {t("transactions.detail.resultTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("transactions.fields.status")}</span>
                <Badge variant="outline">{t(`transactions.status.${transaction.status}`)}</Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {t("transactions.fields.finalPrice")}
                </span>
                <span className="font-display text-xl">
                  {formatAuctionMoney(transaction.final_price, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("transactions.fields.role")}</span>
                <span>
                  {isBuyer
                    ? t("transactions.roles.buyer")
                    : isSeller
                      ? t("transactions.roles.seller")
                      : t("transactions.roles.admin")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {t("transactions.fields.bidHistoryHash")}
                </span>
                <span className="truncate font-mono text-xs">{transaction.bid_history_hash}</span>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/auctions/$auctionId" params={{ auctionId: transaction.auction_id }}>
                  {t("transactions.detail.viewAuction")}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {t("transactions.timeline.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {timeline.map((step) => (
                  <li key={step.key} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${
                        step.done ? "border-foreground bg-foreground text-background" : "border-border"
                      }`}
                    >
                      {step.done ? <Check className="size-3.5" aria-hidden /> : null}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{step.label}</p>
                      {step.at ? (
                        <p className="text-xs text-muted-foreground">
                          {formatAuctionDate(step.at, locale)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>

              {transaction.status === "disputed" ? (
                <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="size-4" aria-hidden />
                    {t("transactions.dispute.openedTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{transaction.dispute_reason}</p>
                  {transaction.dispute_opened_at ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatAuctionDate(transaction.dispute_opened_at, locale)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {t("transactions.disclaimer.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("transactions.disclaimer.body")}
              </p>
              <p>{t("transactions.disclaimer.notEscrow")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {t("transactions.actions.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isBuyer ? (
                <ConfirmationDialog
                  open={buyerOpen}
                  onOpenChange={(next) => {
                    setBuyerOpen(next);
                    if (!next) setBuyerAck(false);
                  }}
                  trigger={
                    <Button
                      className="w-full"
                      variant="gold"
                      disabled={!open || Boolean(transaction.buyer_confirmed_at)}
                    >
                      {transaction.buyer_confirmed_at
                        ? t("transactions.actions.buyerConfirmed")
                        : t("transactions.actions.buyerConfirm")}
                    </Button>
                  }
                  title={t("transactions.actions.buyerDialogTitle")}
                  description={t("transactions.actions.buyerDialogDescription")}
                  confirmLabel={t("transactions.actions.confirmLabel")}
                  cancelLabel={t("common.cancel")}
                  tone="gold"
                  loading={confirmBuyer.isPending}
                  confirmDisabled={!buyerAck}
                  onConfirm={async () => {
                    if (!buyerAck) return;
                    try {
                      await confirmBuyer.mutateAsync(transaction.id);
                      toast.success(t("transactions.actions.confirmed"));
                    } catch {
                      toast.error(t("transactions.actions.failed"));
                    }
                    setBuyerOpen(false);
                    setBuyerAck(false);
                  }}
                >
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox
                      checked={buyerAck}
                      onCheckedChange={(value) => setBuyerAck(value === true)}
                    />
                    <span>{t("transactions.actions.buyerAcknowledgement")}</span>
                  </label>
                </ConfirmationDialog>
              ) : null}

              {isSeller ? (
                <ConfirmationDialog
                  open={sellerOpen}
                  onOpenChange={(next) => {
                    setSellerOpen(next);
                    if (!next) setSellerAck(false);
                  }}
                  trigger={
                    <Button
                      className="w-full"
                      variant="gold"
                      disabled={!open || Boolean(transaction.seller_confirmed_at)}
                    >
                      {transaction.seller_confirmed_at
                        ? t("transactions.actions.sellerConfirmed")
                        : t("transactions.actions.sellerConfirm")}
                    </Button>
                  }
                  title={t("transactions.actions.sellerDialogTitle")}
                  description={t("transactions.actions.sellerDialogDescription")}
                  confirmLabel={t("transactions.actions.confirmLabel")}
                  cancelLabel={t("common.cancel")}
                  tone="gold"
                  loading={confirmSeller.isPending}
                  confirmDisabled={!sellerAck}
                  onConfirm={async () => {
                    if (!sellerAck) return;
                    try {
                      await confirmSeller.mutateAsync(transaction.id);
                      toast.success(t("transactions.actions.confirmed"));
                    } catch {
                      toast.error(t("transactions.actions.failed"));
                    }
                    setSellerOpen(false);
                    setSellerAck(false);
                  }}
                >
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox
                      checked={sellerAck}
                      onCheckedChange={(value) => setSellerAck(value === true)}
                    />
                    <span>{t("transactions.actions.sellerAcknowledgement")}</span>
                  </label>
                </ConfirmationDialog>
              ) : null}

              {(isBuyer || isSeller) && canOpenDispute(transaction.status) ? (
                <ConfirmationDialog
                  open={disputeOpen}
                  onOpenChange={(next) => {
                    setDisputeOpen(next);
                    if (!next) setReason("");
                  }}
                  trigger={
                    <Button className="w-full" variant="outline">
                      {t("transactions.dispute.open")}
                    </Button>
                  }
                  title={t("transactions.dispute.dialogTitle")}
                  description={t("transactions.dispute.dialogDescription")}
                  confirmLabel={t("transactions.dispute.confirmLabel")}
                  cancelLabel={t("common.cancel")}
                  tone="destructive"
                  loading={dispute.isPending}
                  confirmDisabled={reason.trim().length === 0}
                  onConfirm={async () => {
                    if (reason.trim().length === 0) return;
                    try {
                      await dispute.mutateAsync({
                        transactionId: transaction.id,
                        reason: reason.trim(),
                      });
                      toast.success(t("transactions.dispute.opened"));
                    } catch {
                      toast.error(t("transactions.dispute.failed"));
                    }
                    setDisputeOpen(false);
                    setReason("");
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="dispute-reason">{t("transactions.dispute.reasonLabel")}</Label>
                    <Textarea
                      id="dispute-reason"
                      value={reason}
                      rows={4}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </div>
                </ConfirmationDialog>
              ) : null}

              {transaction.status === "disputed" ? (
                <p className="text-sm text-muted-foreground">
                  {t("transactions.dispute.confirmationsBlocked")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
