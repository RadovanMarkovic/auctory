import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { footerNav } from "@/config/navigation";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="mt-24 border-t border-border bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <p className="font-display text-2xl tracking-[0.16em] uppercase">{t("common.brand")}</p>
          <div className="rule-gold" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted-foreground">{t("footer.tagline")}</p>
        </div>

        {footerNav.map((group) => (
          <div key={group.titleKey} className="space-y-4">
            <p className="eyebrow">{t(group.titleKey)}</p>
            <ul className="space-y-2.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <p className="tracking-[0.14em] uppercase">{t("footer.network")}</p>
        </div>
      </div>
    </footer>
  );
}
