import { Link } from "@tanstack/react-router";

import { primaryNav } from "@/config/navigation";
import { AccountMenu } from "./AccountMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { WalletButton } from "./WalletButton";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-5 py-4 sm:px-8">
        <MobileNav />

        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-[0.16em] uppercase">Auctory</span>
          <span className="hidden text-[0.625rem] tracking-[0.24em] text-gold uppercase sm:inline">
            Est. MMXXVI
          </span>
        </Link>

        <nav aria-label="Main" className="ml-8 hidden items-center gap-8 lg:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <WalletButton className="hidden md:inline-flex" />
          <LanguageSwitcher />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
