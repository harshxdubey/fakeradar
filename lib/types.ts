export type Marketplace = "amazon_in" | "flipkart" | "myntra" | "meesho";

export interface Product {
  brand: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  /** Authorised product photos (data URLs, resized client-side). */
  photos: string[];
  authorisedSellers: string[];
  /** Kept for older saved data; scans use `marketplaces` when present. */
  marketplace: Marketplace;
  /** Marketplaces to search, e.g. ["amazon_in", "flipkart", "myntra"]. */
  marketplaces?: Marketplace[];
  /** 64-bit image fingerprints (hex) of the authorised photos, computed in the browser. */
  photoHashes?: string[];
  /** Brand history sent with each scan, so repeat offenders and re-listed fakes stand out. */
  knownOffenders?: { seller: string; count: number }[];
  confirmedAsins?: string[];
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
  /** Brand as shown on the marketplace, when the source provides it. */
  brand?: string;
  /** Where the listing was found (absent = Amazon.in, for data saved before multi-marketplace). */
  marketplace?: Marketplace;
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
  /** 0–1 similarity between the listing photo and the closest authorised photo. */
  photoMatch?: number;
  /** First time this listing has been seen for this product (needs the database). */
  isNew?: boolean;
}

export interface ScanResult {
  id: string;
  createdAt: string;
  mode: "mock" | "live";
  /** Who judged the listings: pre-baked demo verdicts, Claude, Gemini, or the free rule checks. */
  classifier: "demo" | "claude" | "gemini" | "rules";
  /** Set when the AI provider failed on some listings and the free rules filled in. */
  aiNote?: string;
  /** Listings never seen in an earlier scan of this product (undefined = first scan or no database). */
  newCount?: number;
  /** Marketplaces searched, and any that failed this time. */
  marketplaces?: Marketplace[];
  marketNotes?: string[];
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

export type TakedownStatus = "confirmed" | "reported" | "removed" | "still_live" | "rejected";

/** One confirmed fake followed from confirmation to removal, across scans. */
export interface TrackedTakedown {
  asin: string;
  url: string;
  title: string;
  seller: string;
  price: number;
  imageUrl: string;
  marketplace?: Marketplace;
  productKey: string;
  productLabel: string;
  scanId: string;
  demo: boolean;
  status: TakedownStatus;
  confirmedAt: string;
  reportedAt?: string;
  checkedAt?: string;
  checkNote?: string;
}

export interface RecheckResult {
  live: boolean;
  title?: string;
  price?: number;
  seller?: string;
  note: string;
}

export type Bucket = "queue" | "unsure" | "hidden";

/** A live scan still running on Apify (one run per marketplace); the browser polls until all finish. */
export interface PendingRun {
  marketplace: Marketplace;
  runId: string;
  datasetId: string;
}
export interface PendingScan {
  runs: PendingRun[];
}
