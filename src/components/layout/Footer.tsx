import { Link } from "@tanstack/react-router";

import { footerNav } from "@/config/navigation";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <p className="font-display text-2xl tracking-[0.16em] uppercase">Auctory</p>
          <div className="rule-gold" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            A bilingual auction house for luxury watches, fine jewelry, collectibles, and
            limited-edition fashion — with verifiable on-chain certificates of provenance.
          </p>
        </div>

        {footerNav.map((group) => (
          <div key={group.title} className="space-y-4">
            <p className="eyebrow">{group.title}</p>
            <ul className="space-y-2.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Auctory. All rights reserved.</p>
          <p className="tracking-[0.14em] uppercase">Certificates on Sepolia testnet</p>
        </div>
      </div>
    </footer>
  );
}
