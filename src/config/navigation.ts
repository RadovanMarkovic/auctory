/**
 * Central navigation map for the Auctory shell.
 * Route paths must stay in sync with files under src/routes.
 * `labelKey` refers to a key in the i18n translation files.
 */
export interface NavItem {
  labelKey: string;
  to: string;
}

export const primaryNav: NavItem[] = [
  { labelKey: "nav.auctions", to: "/auctions" },
  { labelKey: "nav.products", to: "/products" },
  { labelKey: "nav.categories", to: "/categories" },
  { labelKey: "nav.sell", to: "/sell" },
  { labelKey: "nav.howItWorks", to: "/how-it-works" },
];


export const footerNav: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: "nav.groups.marketplace",
    items: [
      { labelKey: "nav.liveAuctions", to: "/auctions" },
      { labelKey: "nav.categories", to: "/categories" },
      { labelKey: "nav.sellWithUs", to: "/sell" },
    ],
  },
  {
    titleKey: "nav.groups.company",
    items: [
      { labelKey: "nav.howItWorks", to: "/how-it-works" },
      { labelKey: "nav.account", to: "/profile" },
    ],
  },
];
