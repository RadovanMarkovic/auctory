/**
 * Shared domain types for Auctory.
 * These mirror the intended Lovable Cloud schema; no data layer is wired yet.
 */

export type Locale = "en" | "sr";

export type UserRole = "buyer" | "seller" | "admin";

export type ProductCategory = "watches" | "jewelry" | "collectibles" | "fashion";

export type ListingStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "live"
  | "ended"
  | "cancelled";

export type AuctionStatus = "scheduled" | "live" | "ended" | "settled" | "cancelled";

export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded";

export type CertificateStatus = "not_minted" | "minting" | "minted" | "failed";

export interface LocalizedText {
  en: string;
  sr: string;
}

export interface Money {
  /** Minor units (e.g. cents) to avoid float drift. */
  amount: number;
  currency: "EUR" | "USD";
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  roles: UserRole[];
  walletAddress?: string | null;
  createdAt: string;
}

export interface Listing {
  id: string;
  sellerId: string;
  title: LocalizedText;
  description: LocalizedText;
  category: ProductCategory;
  brand?: string;
  condition?: string;
  images: string[];
  reservePrice?: Money | null;
  startingPrice: Money;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Auction {
  id: string;
  listingId: string;
  status: AuctionStatus;
  startsAt: string;
  endsAt: string;
  currentPrice: Money;
  bidIncrement: Money;
  bidCount: number;
  highestBidderId?: string | null;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: Money;
  placedAt: string;
}

export interface Order {
  id: string;
  auctionId: string;
  buyerId: string;
  total: Money;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface Certificate {
  id: string;
  listingId: string;
  status: CertificateStatus;
  /** Sepolia ERC-721 details, populated after minting. */
  contractAddress?: string | null;
  tokenId?: string | null;
  txHash?: string | null;
  metadataUri?: string | null;
}

export interface OwnershipRecord {
  id: string;
  certificateId: string;
  ownerAddress: string;
  ownerId?: string | null;
  acquiredAt: string;
  txHash?: string | null;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
