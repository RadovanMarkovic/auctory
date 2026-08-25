import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { primaryNav } from "@/config/navigation";
import { WalletButton } from "./WalletButton";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("nav.openMenu")}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-sm">
        <SheetHeader>
          <SheetTitle className="font-display text-xl tracking-[0.16em] uppercase">
            {t("common.brand")}
          </SheetTitle>
        </SheetHeader>
        <nav aria-label={t("nav.mobile")} className="mt-8 flex flex-col gap-1 px-4">
          {primaryNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 font-display text-2xl transition-colors hover:text-gold"
              activeProps={{ className: "text-gold" }}
            >
              {t(item.labelKey)}
            </Link>
          ))}
          <div className="mt-6">
            <WalletButton />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
