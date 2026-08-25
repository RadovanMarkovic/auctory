import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setAppLanguage } from "@/i18n/I18nProvider";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "@/i18n";

function FlagGB({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true" role="img">
      <clipPath id="auctory-flag-gb-clip">
        <rect width="60" height="30" rx="3" />
      </clipPath>
      <g clipPath="url(#auctory-flag-gb-clip)">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFF" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 V30 M0,15 H60" stroke="#FFF" strokeWidth="10" />
        <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

function FlagRS({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden="true" role="img">
      <clipPath id="auctory-flag-rs-clip">
        <rect width="60" height="30" rx="3" />
      </clipPath>
      <g clipPath="url(#auctory-flag-rs-clip)">
        <rect width="60" height="10" fill="#C6363C" />
        <rect y="10" width="60" height="10" fill="#0C4076" />
        <rect y="20" width="60" height="10" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

const FLAGS: Record<AppLanguage, (props: { className?: string }) => JSX.Element> = {
  en: FlagGB,
  sr: FlagRS,
};

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language ?? "en") as AppLanguage;
  const CurrentFlag = FLAGS[current] ?? FlagGB;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("language.change")}>
          <CurrentFlag className="h-3.5 w-6 rounded-[2px] ring-1 ring-border" />
          <span className="hidden sm:inline">{current.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="eyebrow">{t("language.label")}</DropdownMenuLabel>
        {SUPPORTED_LANGUAGES.map((lng) => {
          const Flag = FLAGS[lng] ?? FlagGB;
          return (
            <DropdownMenuItem
              key={lng}
              onSelect={() => setAppLanguage(lng)}
              className="justify-between gap-3"
            >
              <span className="flex items-center gap-2">
                <Flag className="h-3.5 w-6 rounded-[2px] ring-1 ring-border" />
                {t(`language.${lng}`)}
              </span>
              {current === lng ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
