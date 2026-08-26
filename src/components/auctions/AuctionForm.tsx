import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmationDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatAuctionDate,
  formatAuctionMoney,
  fromLocalInputValue,
  useAuctionableProducts,
  type AuctionStatus,
} from "@/lib/auctions";

export interface AuctionFormValues {
  product_id: string | null;
  start_price: string;
  reserve_price: string;
  minimum_increment: string;
  starts_at: string;
  ends_at: string;
  anti_sniping_minutes: string;
}

export const emptyAuctionForm: AuctionFormValues = {
  product_id: null,
  start_price: "",
  reserve_price: "",
  minimum_increment: "10",
  starts_at: "",
  ends_at: "",
  anti_sniping_minutes: "5",
};

export interface AuctionPayload {
  product_id: string;
  start_price: number;
  reserve_price: number | null;
  minimum_increment: number;
  starts_at: string;
  ends_at: string;
  original_ends_at: string;
  anti_sniping_minutes: number;
  status: AuctionStatus;
}

export function toAuctionPayload(
  values: AuctionFormValues,
  status: AuctionStatus,
): AuctionPayload | null {
  const startsAt = fromLocalInputValue(values.starts_at);
  const endsAt = fromLocalInputValue(values.ends_at);
  if (!values.product_id || !startsAt || !endsAt) return null;
  const reserve = values.reserve_price.trim();
  return {
    product_id: values.product_id,
    start_price: Number.parseFloat(values.start_price),
    reserve_price: reserve ? Number.parseFloat(reserve) : null,
    minimum_increment: Number.parseFloat(values.minimum_increment),
    starts_at: startsAt,
    ends_at: endsAt,
    original_ends_at: endsAt,
    anti_sniping_minutes: Number.parseInt(values.anti_sniping_minutes, 10),
    status,
  };
}

export function AuctionForm({
  initialValues,
  submitting,
  readOnly = false,
  readOnlyReason,
  lockedProductLabel,
  onSubmit,
  extraActions,
}: {
  initialValues: AuctionFormValues;
  submitting?: boolean;
  readOnly?: boolean;
  readOnlyReason?: string;
  /** Shown instead of the product picker when the product can no longer be changed. */
  lockedProductLabel?: string;
  onSubmit: (values: AuctionFormValues, status: AuctionStatus) => void;
  extraActions?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("sr") ? "sr-RS" : "en-GB";
  const [values, setValues] = useState<AuctionFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const productsQuery = useAuctionableProducts(initialValues.product_id);
  const products = productsQuery.data ?? [];

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === values.product_id) ?? null,
    [products, values.product_id],
  );

  function set<K extends keyof AuctionFormValues>(key: K, value: AuctionFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const required = t("auctions.form.requiredField");

    if (!values.product_id) next["product_id"] = required;

    const start = Number.parseFloat(values.start_price);
    if (!values.start_price.trim()) next["start_price"] = required;
    else if (!Number.isFinite(start) || start <= 0)
      next["start_price"] = t("auctions.form.errors.positive");

    if (values.reserve_price.trim()) {
      const reserve = Number.parseFloat(values.reserve_price);
      if (!Number.isFinite(reserve) || reserve <= 0)
        next["reserve_price"] = t("auctions.form.errors.positive");
      else if (Number.isFinite(start) && reserve < start)
        next["reserve_price"] = t("auctions.form.errors.reserveBelowStart");
    }

    const increment = Number.parseFloat(values.minimum_increment);
    if (!values.minimum_increment.trim()) next["minimum_increment"] = required;
    else if (!Number.isFinite(increment) || increment <= 0)
      next["minimum_increment"] = t("auctions.form.errors.positive");

    const startsAt = fromLocalInputValue(values.starts_at);
    const endsAt = fromLocalInputValue(values.ends_at);
    if (!startsAt) next["starts_at"] = required;
    if (!endsAt) next["ends_at"] = required;
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt))
      next["ends_at"] = t("auctions.form.errors.endBeforeStart");

    const minutes = Number.parseInt(values.anti_sniping_minutes, 10);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 60)
      next["anti_sniping_minutes"] = t("auctions.form.errors.antiSnipingRange");

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSaveDraft(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    onSubmit(values, "draft");
  }

  function handleScheduleClick() {
    if (!validate()) return;
    const startsAt = fromLocalInputValue(values.starts_at);
    if (startsAt && new Date(startsAt).getTime() <= Date.now()) {
      setErrors({ starts_at: t("auctions.form.errors.startInPast") });
      return;
    }
    setConfirmOpen(true);
  }

  const disabled = readOnly || submitting;

  return (
    <form onSubmit={handleSaveDraft} className="space-y-8">
      {readOnly && readOnlyReason ? (
        <p className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {readOnlyReason}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("auctions.form.sections.product")}</CardTitle>
          <CardDescription>{t("auctions.form.sections.productHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="auction-product">
            {t("auctions.fields.product")}
            <RequiredMark />
          </Label>
          {lockedProductLabel ? (
            <p className="text-sm">{lockedProductLabel}</p>
          ) : (
            <>
              <Select
                value={values.product_id ?? ""}
                onValueChange={(value) => set("product_id", value || null)}
                disabled={disabled}
              >
                <SelectTrigger id="auction-product" aria-invalid={Boolean(errors["product_id"])}>
                  <SelectValue placeholder={t("auctions.form.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {[product.brands?.name, product.title, product.model]
                        .filter(Boolean)
                        .join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {products.length === 0 && !productsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t("auctions.form.noEligibleProducts")}
                </p>
              ) : null}
            </>
          )}
          {errors["product_id"] ? (
            <p className="text-sm text-destructive">{errors["product_id"]}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("auctions.form.sections.pricing")}</CardTitle>
          <CardDescription>{t("auctions.form.sections.pricingHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="start-price">
              {t("auctions.fields.startPrice")}
              <RequiredMark />
            </Label>
            <Input
              id="start-price"
              inputMode="decimal"
              value={values.start_price}
              disabled={disabled}
              aria-invalid={Boolean(errors["start_price"])}
              onChange={(event) => set("start_price", event.target.value)}
            />
            {errors["start_price"] ? (
              <p className="text-sm text-destructive">{errors["start_price"]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reserve-price">{t("auctions.fields.reservePrice")}</Label>
            <Input
              id="reserve-price"
              inputMode="decimal"
              value={values.reserve_price}
              disabled={disabled}
              aria-invalid={Boolean(errors["reserve_price"])}
              onChange={(event) => set("reserve_price", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("auctions.fields.reserveHint")}</p>
            {errors["reserve_price"] ? (
              <p className="text-sm text-destructive">{errors["reserve_price"]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimum-increment">
              {t("auctions.fields.minimumIncrement")}
              <RequiredMark />
            </Label>
            <Input
              id="minimum-increment"
              inputMode="decimal"
              value={values.minimum_increment}
              disabled={disabled}
              aria-invalid={Boolean(errors["minimum_increment"])}
              onChange={(event) => set("minimum_increment", event.target.value)}
            />
            {errors["minimum_increment"] ? (
              <p className="text-sm text-destructive">{errors["minimum_increment"]}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("auctions.form.sections.schedule")}</CardTitle>
          <CardDescription>{t("auctions.form.sections.scheduleHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="starts-at">
              {t("auctions.fields.startsAt")}
              <RequiredMark />
            </Label>
            <Input
              id="starts-at"
              type="datetime-local"
              value={values.starts_at}
              disabled={disabled}
              aria-invalid={Boolean(errors["starts_at"])}
              onChange={(event) => set("starts_at", event.target.value)}
            />
            {errors["starts_at"] ? (
              <p className="text-sm text-destructive">{errors["starts_at"]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ends-at">
              {t("auctions.fields.endsAt")}
              <RequiredMark />
            </Label>
            <Input
              id="ends-at"
              type="datetime-local"
              value={values.ends_at}
              disabled={disabled}
              aria-invalid={Boolean(errors["ends_at"])}
              onChange={(event) => set("ends_at", event.target.value)}
            />
            {errors["ends_at"] ? (
              <p className="text-sm text-destructive">{errors["ends_at"]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="anti-sniping">{t("auctions.fields.antiSniping")}</Label>
            <Input
              id="anti-sniping"
              inputMode="numeric"
              value={values.anti_sniping_minutes}
              disabled={disabled}
              aria-invalid={Boolean(errors["anti_sniping_minutes"])}
              onChange={(event) => set("anti_sniping_minutes", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("auctions.fields.antiSnipingHint")}</p>
            {errors["anti_sniping_minutes"] ? (
              <p className="text-sm text-destructive">{errors["anti_sniping_minutes"]}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("auctions.preview.title")}</CardTitle>
          <CardDescription>{t("auctions.preview.hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <PreviewRow
              label={t("auctions.fields.product")}
              value={
                lockedProductLabel ??
                (selectedProduct
                  ? [selectedProduct.brands?.name, selectedProduct.title]
                      .filter(Boolean)
                      .join(" · ")
                  : "—")
              }
            />
            <PreviewRow
              label={t("auctions.fields.startPrice")}
              value={formatAuctionMoney(values.start_price || null, locale)}
            />
            <PreviewRow
              label={t("auctions.fields.minimumIncrement")}
              value={formatAuctionMoney(values.minimum_increment || null, locale)}
            />
            <PreviewRow
              label={t("auctions.fields.startsAt")}
              value={formatAuctionDate(fromLocalInputValue(values.starts_at), locale)}
            />
            <PreviewRow
              label={t("auctions.fields.endsAt")}
              value={formatAuctionDate(fromLocalInputValue(values.ends_at), locale)}
            />
            <PreviewRow
              label={t("auctions.fields.antiSniping")}
              value={t("auctions.preview.antiSnipingValue", {
                count: Number.parseInt(values.anti_sniping_minutes, 10) || 0,
              })}
            />
          </dl>
          <p className="mt-6 text-sm text-muted-foreground">{t("auctions.preview.reserveHidden")}</p>
        </CardContent>
      </Card>

      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {t("auctions.form.saveDraft")}
          </Button>
          <Button
            type="button"
            variant="gold"
            disabled={submitting}
            onClick={handleScheduleClick}
          >
            {t("auctions.form.schedule")}
          </Button>
          {extraActions}
        </div>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("auctions.confirm.title")}
        description={t("auctions.confirm.description")}
        confirmLabel={t("auctions.confirm.confirm")}
        cancelLabel={t("common.cancel")}
        tone="gold"
        loading={submitting ?? false}
        onConfirm={() => {
          setConfirmOpen(false);
          onSubmit(values, "scheduled");
        }}
      />
    </form>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
