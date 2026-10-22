export type Marketplace = "amazon_in" | "flipkart" | "meesho";

export interface Product {
  brand: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  /** Authorised product photos (data URLs, resized client-side). */
  photos: string[];
  authorisedSellers: string[];
  marketplace: Marketplace;
}

/** One marketplace listing — also the contract the n8n webhook must return. */
export interface Listing {
  id: string;
  url: string;
  asin: string;
  title: string;
  price: number;
  seller: string;
  imageUrl: string;
}

export type VerdictLabel =
  | "counterfeit"
  | "copycat"
  | "possible_genuine_reseller"
  | "unrelated";

export type SellerRisk = "low" | "medium" | "high";

export interface Verdict {
  label: VerdictLabel;
  confidence: number;
  evidence: string[];
  seller_risk: SellerRisk;
}

export interface ScanItem {
  listing: Listing;
  verdict: Verdict;
}

export interface ScanResult {
  id: string;
  createdAt: string;
  mode: "mock" | "live";
  product: Product;
  /** Unique listings found (after dedupe). */
  scanned: number;
  duplicatesRemoved: number;
  /** Listings dropped before AI because the seller is authorised. */
  authorisedFiltered: Listing[];
  items: ScanItem[];
}

export type Decision = "confirmed" | "genuine" | "unsure";

/** Client-side state for a scan: result + the owner's decisions. */
export interface StoredScan {
  result: ScanResult;
  decisions: Record<string, Decision>;
  takedowns: Record<string, string>;
}

export type Bucket = "queue" | "unsure" | "hidden";
