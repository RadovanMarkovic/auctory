/**
 * TEMPORARY MOCK DATA — home page only.
 *
 * This module is the single isolated source of fake data for the public home
 * page. When Lovable Cloud tables are wired up, replace `fetchHomeData` with a
 * real query/loader and delete this file. Nothing else should import the
 * literals below.
 */

import type { Money, ProductCategory } from "@/types/auction";

export interface HomeLot {
  id: string;
  title: string;
  brand: string;
  category: ProductCategory;
  currentBid: Money;
  bidCount: number;
  /** ISO timestamp when the lot closes. */
  endsAt: string;
  certified: boolean;
}

export interface HomeCategory {
  key: ProductCategory;
  name: string;
  blurb: string;
  lotCount: number;
}

export interface HomeStats {
  lotsSold: number;
  certificatesMinted: number;
  averageSellThrough: number;
  registeredBidders: number;
}

export interface HomeData {
  featured: HomeLot[];
  endingSoon: HomeLot[];
  categories: HomeCategory[];
  stats: HomeStats;
}

const eur = (amount: number): Money => ({ amount: amount * 100, currency: "EUR" });

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const featured: HomeLot[] = [
  {
    id: "lot-1001",
    title: "Perpetual chronograph, steel on bracelet",
    brand: "Patek Philippe",
    category: "watches",
    currentBid: eur(84_500),
    bidCount: 27,
    endsAt: inHours(38),
    certified: true,
  },
  {
    id: "lot-1002",
    title: "Art Deco platinum and diamond bracelet",
    brand: "Cartier",
    category: "jewelry",
    currentBid: eur(31_200),
    bidCount: 14,
    endsAt: inHours(52),
    certified: true,
  },
  {
    id: "lot-1003",
    title: "First-edition lunar mission archive, 1969",
    brand: "NASA Archive",
    category: "collectibles",
    currentBid: eur(9_800),
    bidCount: 41,
    endsAt: inHours(19),
    certified: false,
  },
];

const endingSoon: HomeLot[] = [
  {
    id: "lot-1004",
    title: "Runway archive trench, numbered 04/50",
    brand: "Maison Margiela",
    category: "fashion",
    currentBid: eur(4_250),
    bidCount: 9,
    endsAt: inHours(1.5),
    certified: true,
  },
  {
    id: "lot-1005",
    title: "Yellow gold day-date, box and papers",
    brand: "Rolex",
    category: "watches",
    currentBid: eur(23_900),
    bidCount: 33,
    endsAt: inHours(3),
    certified: true,
  },
  {
    id: "lot-1006",
    title: "Emerald and rose gold cocktail ring",
    brand: "Bulgari",
    category: "jewelry",
    currentBid: eur(12_400),
    bidCount: 18,
    endsAt: inHours(5.5),
    certified: false,
  },
  {
    id: "lot-1007",
    title: "Signed studio print, edition of 12",
    brand: "Private Collection",
    category: "collectibles",
    currentBid: eur(2_150),
    bidCount: 6,
    endsAt: inHours(7),
    certified: true,
  },
];

const categories: HomeCategory[] = [
  {
    key: "watches",
    name: "Watches",
    blurb: "Vintage and contemporary timepieces from established maisons.",
    lotCount: 128,
  },
  {
    key: "jewelry",
    name: "Jewelry",
    blurb: "Signed pieces, rare gemstones, and estate collections.",
    lotCount: 94,
  },
  {
    key: "collectibles",
    name: "Collectibles",
    blurb: "Design objects, memorabilia, and rare printed matter.",
    lotCount: 61,
  },
  {
    key: "fashion",
    name: "Fashion",
    blurb: "Limited-edition and archival pieces in collectible condition.",
    lotCount: 47,
  },
];

const stats: HomeStats = {
  lotsSold: 2_480,
  certificatesMinted: 2_180,
  averageSellThrough: 92,
  registeredBidders: 18_600,
};

export const homeMockData: HomeData = { featured, endingSoon, categories, stats };

/** Simulates the future Cloud query so the UI can already render async states. */
export async function fetchHomeData(): Promise<HomeData> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return homeMockData;
}
