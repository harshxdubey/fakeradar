// Direct Apify connection (no n8n needed). Each marketplace has an adapter: which Apify actor
// searches it, what input it takes, and how its items become FakeRadar listings. Live scans start
// one background run per marketplace; the browser polls /api/scan/poll until all have finished.
import { brandCore } from "./rulesClassifier";
import type { Listing, Marketplace, PendingRun, Product, RecheckResult } from "./types";

const API = "https://api.apify.com/v2";

export const hasApifyToken = () => Boolean(process.env.APIFY_TOKEN);

async function apify(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.APIFY_TOKEN}`,
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function nameWords(product: Product, core: string): string[] {
  return product.name
    .replace(/['’]s\b/gi, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && w.toLowerCase() !== core)
    .slice(0, 6);
}

/**
 * Three searches per scan, so fakes are found however they are titled:
 * 1. brand + product (direct fakes), 2. product without brand (copycats hiding your name),
 * 3. brand alone (other products misusing your brand).
 */
export function searchQueries(product: Product): string[] {
  const core = brandCore(product.brand);
  const words = nameWords(product, core);
  return [...new Set([[core, ...words].join(" "), words.join(" "), core].map((q) => q.trim()).filter(Boolean))];
}

const amazonSearch = (q: string) => `https://www.amazon.in/s?k=${encodeURIComponent(q).replace(/%20/g, "+")}`;
export const searchUrls = (product: Product) => searchQueries(product).map(amazonSearch);

// ---- Marketplace adapters ----

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Adapter {
  id: Marketplace;
  label: string;
  actor: string;
  /** Run input for a scan of this product. */
  input(product: Product): object;
  toListing(item: any): Listing | null;
  /** Product id from one of this marketplace's product links, or null if the link isn't one. */
  productIdFromUrl(url: string): string | null;
  /** Run input that re-checks a single product. */
  recheckInput(id: string, url: string): object;
}

const n = (v: unknown) => Number(v) || 0;

const amazon: Adapter = {
  id: "amazon_in",
  label: "Amazon.in",
  actor: process.env.APIFY_ACTOR || "junglee/Amazon-crawler",
  input(product) {
    const urls = searchUrls(product);
    const max = Number(process.env.APIFY_MAX_ITEMS) || 30;
    return {
      categoryOrProductUrls: urls.map((url) => ({ url })),
      maxItemsPerStartUrl: Math.max(5, Math.ceil(max / urls.length)),
      maxSearchPagesPerStartUrl: 1,
      scrapeProductDetails: true, // needed for seller name and brand
      scrapeSellers: false,
      maxOffers: 0,
      maxProductVariantsAsSeparateResults: 0,
    };
  },
  toListing(item) {
    if (!item?.asin || !item.title) return null;
    return {
      id: item.asin,
      asin: item.asin,
      url: item.url || `https://www.amazon.in/dp/${item.asin}`,
      title: item.title,
      price: n(item.price?.value),
      seller: item.seller?.name || "Unknown seller",
      imageUrl: item.highResolutionImages?.[0] || item.thumbnailImage || "",
      brand: item.brand,
      marketplace: "amazon_in",
    };
  },
  productIdFromUrl: (url) => url.match(/^https:\/\/www\.amazon\.in\/(?:[^/?#]+\/)?dp\/([A-Z0-9]{10})(?:[/?#].*)?$/)?.[1] ?? null,
  recheckInput: (id) => ({
    categoryOrProductUrls: [{ url: `https://www.amazon.in/dp/${id}` }],
    maxItemsPerStartUrl: 1,
    scrapeProductDetails: true,
    maxOffers: 0,
    maxProductVariantsAsSeparateResults: 0,
  }),
};

const flipkart: Adapter = {
  id: "flipkart",
  label: "Flipkart",
  actor: "scrapesage/flipkart-scraper",
  input: (product) => ({
    searchTerms: searchQueries(product),
    maxProducts: Number(process.env.FLIPKART_MAX_ITEMS) || 15,
    maxPagesPerSearch: 1,
    includeProductDetails: true, // seller name and brand
    includeReviews: false,
    outputSellerLeads: false,
    deduplicateProducts: true,
  }),
  toListing(item) {
    if (!item?.productId || !item.title || item.type === "seller") return null;
    return {
      id: `fk-${item.productId}`,
      asin: item.productId,
      url: item.url || `https://www.flipkart.com/product/p/itm?pid=${item.productId}`,
      title: item.fullTitle || item.title,
      price: n(item.price),
      seller: item.sellerName || "Unknown seller",
      imageUrl: item.mainImage || item.image || "",
      brand: item.brand,
      marketplace: "flipkart",
    };
  },
  productIdFromUrl: (url) =>
    /^https:\/\/(www\.)?flipkart\.com\//.test(url) ? (url.match(/[?&]pid=([A-Z0-9]{8,20})/)?.[1] ?? null) : null,
  recheckInput: (id) => ({ productIds: [id], maxProducts: 1, includeProductDetails: true, includeReviews: false }),
};

/** Myntra image URLs are templates: "h_($height),q_($qualityPercentage),w_($width)". */
const myntraImage = (src?: string) =>
  (src ?? "").replace("($height)", "720").replace("($qualityPercentage)", "90").replace("($width)", "540");

const myntra: Adapter = {
  id: "myntra",
  label: "Myntra",
  actor: "khadinakbar/myntra-product-scraper",
  // Myntra's scraper takes one keyword: the brand + product query finds both fakes and lookalikes.
  input: (product) => ({
    search: searchQueries(product)[0],
    maxItems: Number(process.env.MYNTRA_MAX_ITEMS) || 12,
    enrichDetails: true, // seller name
  }),
  toListing(item) {
    if (!item?.productId || !item.name) return null;
    return {
      id: `my-${item.productId}`,
      asin: String(item.productId),
      url: item.url || `https://www.myntra.com/${item.productId}`,
      title: item.brand && !String(item.name).startsWith(item.brand) ? `${item.brand} ${item.name}` : item.name,
      price: n(item.price),
      seller: item.seller || "Unknown seller",
      imageUrl: myntraImage(item.images?.[0]),
      brand: item.brand,
      marketplace: "myntra",
    };
  },
  productIdFromUrl: (url) => (/^https:\/\/(www\.)?myntra\.com\//.test(url) ? (url.match(/\/(\d{5,12})(?:\/buy)?\/?(?:[?#].*)?$/)?.[1] ?? null) : null),
  recheckInput: (id) => ({ productIds: [id], maxItems: 1 }),
};

export const ADAPTERS: Record<Exclude<Marketplace, "meesho">, Adapter> = { amazon_in: amazon, flipkart, myntra };
export const SUPPORTED_MARKETPLACES = Object.keys(ADAPTERS) as (keyof typeof ADAPTERS)[];
export const marketplaceLabel = (m?: Marketplace) => (m && m in ADAPTERS ? ADAPTERS[m as keyof typeof ADAPTERS].label : "Amazon.in");

/** The marketplaces a product asks for (older saved products only have `marketplace`). */
export function productMarketplaces(product: Product): (keyof typeof ADAPTERS)[] {
  const wanted = product.marketplaces?.length ? product.marketplaces : [product.marketplace || "amazon_in"];
  const ok = wanted.filter((m): m is keyof typeof ADAPTERS => m in ADAPTERS);
  return ok.length ? [...new Set(ok)] : ["amazon_in"];
}

// ---- Runs ----

const actorPath = (actor: string) => actor.replace("/", "~");

function webhooksParam(webhookUrl?: string) {
  if (!webhookUrl) return "";
  const hooks = [{ eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"], requestUrl: webhookUrl }];
  return `?webhooks=${encodeURIComponent(Buffer.from(JSON.stringify(hooks)).toString("base64"))}`;
}

/**
 * Starts one background run per marketplace.
 * @param webhookUrl optional URL Apify calls when each run ends (daily scans, so no one has to poll).
 */
export async function startRuns(product: Product, webhookUrl?: string): Promise<PendingRun[]> {
  return Promise.all(
    productMarketplaces(product).map(async (m) => {
      const a = ADAPTERS[m];
      const json = await apify(`/acts/${actorPath(a.actor)}/runs${webhooksParam(webhookUrl)}`, {
        method: "POST",
        body: JSON.stringify(a.input(product)),
      });
      return { marketplace: m, runId: json.data.id as string, datasetId: json.data.defaultDatasetId as string };
    }),
  );
}

export type RunStatus = "running" | "succeeded" | "failed";

export async function getRunStatus(runId: string): Promise<RunStatus> {
  const json = await apify(`/actor-runs/${encodeURIComponent(runId)}`);
  const s: string = json.data.status;
  if (s === "SUCCEEDED") return "succeeded";
  if (s === "READY" || s === "RUNNING") return "running";
  return "failed"; // FAILED, ABORTED, TIMED-OUT
}

export async function getRunListings(datasetId: string, marketplace: Marketplace = "amazon_in"): Promise<Listing[]> {
  const a = ADAPTERS[(marketplace in ADAPTERS ? marketplace : "amazon_in") as keyof typeof ADAPTERS];
  const items = (await apify(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=200`)) as unknown[];
  return items.map((item) => a.toListing(item)).filter((l): l is Listing => l !== null);
}

/** Which marketplace a product link belongs to, with its product id. */
export function parseProductUrl(url: string): { marketplace: keyof typeof ADAPTERS; id: string } | null {
  for (const m of SUPPORTED_MARKETPLACES) {
    const id = ADAPTERS[m].productIdFromUrl(url);
    if (id) return { marketplace: m, id };
  }
  return null;
}

/**
 * Re-check one listing: is it still up? Runs the marketplace's scraper on the product and waits
 * (about 15–30 s). No item back, or out of stock, is what a takedown looks like.
 */
export async function recheckListing(url: string): Promise<RecheckResult> {
  const parsed = parseProductUrl(url);
  if (!parsed) throw new Error("Not a supported product link");
  const a = ADAPTERS[parsed.marketplace];
  const items = (await apify(`/acts/${actorPath(a.actor)}/run-sync-get-dataset-items?timeout=55&clean=true`, {
    method: "POST",
    body: JSON.stringify(a.recheckInput(parsed.id, url)),
  })) as Record<string, any>[];
  const raw = items.find((i) => i && i.type !== "seller");
  const listing = raw ? a.toListing(raw) : null;
  if (!listing) return { live: false, note: `Listing not found on ${a.label} — it looks removed.` };
  const outOfStock = raw?.inStock === false || /out.?of.?stock|unavailable|discontinued/i.test(String(raw?.availabilityState ?? ""));
  if (outOfStock) {
    return { live: false, title: listing.title, seller: listing.seller, note: "Page exists but the item is unavailable — likely taken down." };
  }
  return {
    live: true,
    title: listing.title,
    price: listing.price || undefined,
    seller: listing.seller,
    note: `Still live on ${a.label}${listing.seller !== "Unknown seller" ? `, sold by ${listing.seller}` : ""}.`,
  };
}
