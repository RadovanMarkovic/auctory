import type { Money } from "@/types/auction";

export function formatMoney(money: Money, locale = "en-GB") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount / 100);
}

/** Compact "2d 04h" / "3h 12m" / "8m" countdown label. */
export function formatTimeLeft(
  endsAt: string,
  now: number = Date.now(),
  closedLabel = "Closed",
) {
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return closedLabel;

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${String(hours % 24).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${minutes}m`;
}
