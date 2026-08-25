/**
 * Central navigation map for the Auctory shell.
 * Route paths must stay in sync with files under src/routes.
 */
export interface NavItem {
  label: string;
  to: string;
}

export const primaryNav: NavItem[] = [
  { label: "Auctions", to: "/auctions" },
  { label: "Categories", to: "/categories" },
  { label: "Sell", to: "/sell" },
  { label: "How it works", to: "/how-it-works" },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Marketplace",
    items: [
      { label: "Live auctions", to: "/auctions" },
      { label: "Categories", to: "/categories" },
      { label: "Sell with us", to: "/sell" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "How it works", to: "/how-it-works" },
      { label: "Account", to: "/account" },
    ],
  },
];
