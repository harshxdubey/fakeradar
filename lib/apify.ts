// Direct Apify connection (no n8n needed). Runs the Amazon scraper in the background;
// the browser polls /api/scan/poll so no single request hits the hosting time limit.
import { brandCore } from "./rulesClassifier";
import type { Listing, PendingScan, Product, RecheckResult } from "./types";

const API = "https://api.apify.com/v2";
const ACTOR = () => (process.env.APIFY_ACTOR || "junglee/Amazon-crawler").replace("/", "~");
const MAX_ITEMS = () => Number(process.env.APIFY_MAX_ITEMS) || 30;

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

const amazonSearch = (q: string) =>
  `https://www.amazon.in/s?k=${encodeURIComponent(q.trim()).replace(/%20/g, "+")}`;

/**
 * Three searches per scan, so fakes are found however they are titled:
 * 1. brand + product (direct fakes), 2. product without brand (copycats hiding your name),
 * 3. brand alone (other products misusing your brand).
 */
export function searchUrls(product: Product): string[] {
  const core = brandCore(product.brand);
  const words = nameWords(product, core);
  const urls = [amazonSearch([core, ...words].join(" ")), amazonSearch(words.join(" ")), amazonSearch(core)];
  return [...new Set(urls.filter((u) => !u.endsWith("k=")))];
}

/** Kept for callers that want the main query only. */
export const searchUrl = (product: Product) => searchUrls(product)[0];

/**
 * @param webhookUrl optional URL Apify calls when the run ends (used by daily scans, so no one has to poll).
 */
export async function startApifyRun(product: Product, webhookUrl?: string): Promise<PendingScan> {
  const urls = searchUrls(product);
  const hooks = webhookUrl
    ? `?webhooks=${encodeURIComponent(
        Buffer.from(
          JSON.stringify([{ eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT"], requestUrl: webhookUrl }]),
        ).toString("base64"),
      )}`
    : "";
  const json = await apify(`/acts/${ACTOR()}/runs${hooks}`, {
    method: "POST",
    body: JSON.stringify({
      categoryOrProductUrls: urls.map((url) => ({ url })),
      maxItemsPerStartUrl: Math.max(5, Math.ceil(MAX_ITEMS() / urls.length)),
      maxSearchPagesPerStartUrl: 1,
      scrapeProductDetails: true, // needed for seller name and brand
      scrapeSellers: false,
      maxOffers: 0,
      maxProductVariantsAsSeparateResults: 0,
    }),
  });
  return { runId: json.data.id, datasetId: json.data.defaultDatasetId };
}

export type RunStatus = "running" | "succeeded" | "failed";

export async function getRunStatus(runId: string): Promise<RunStatus> {
  const json = await apify(`/actor-runs/${encodeURIComponent(runId)}`);
  const s: string = json.data.status;
  if (s === "SUCCEEDED") return "succeeded";
  if (s === "READY" || s === "RUNNING") return "running";
  return "failed"; // FAILED, ABORTED, TIMED-OUT
}

interface AmazonItem {
  asin?: string;
  title?: string;
  url?: string;
  brand?: string;
  price?: { value?: number } | null;
  seller?: { name?: string } | null;
  thumbnailImage?: string;
  highResolutionImages?: string[];
}

export function toListing(item: AmazonItem): Listing | null {
  if (!item.asin || !item.title) return null;
  return {
    id: item.asin,
    asin: item.asin,
    url: item.url || `https://www.amazon.in/dp/${item.asin}`,
    title: item.title,
    price: Number(item.price?.value) || 0,
    seller: item.seller?.name || "Unknown seller",
    imageUrl: item.highResolutionImages?.[0] || item.thumbnailImage || "",
    brand: item.brand,
  };
}

export async function getRunListings(datasetId: string): Promise<Listing[]> {
  const items = (await apify(
    `/datasets/${encodeURIComponent(datasetId)}/items?clean=true&fields=asin,title,url,brand,price,seller,thumbnailImage,highResolutionImages`,
  )) as AmazonItem[];
  return items.map((item) => toListing(item)).filter((l): l is Listing => l !== null);
}

/**
 * Re-check one listing: is it still on Amazon.in? Runs the scraper on the product page and waits
 * (about 15 s). No item back = the page is gone or unavailable, which is what a takedown looks like.
 */
export async function recheckListing(url: string): Promise<RecheckResult> {
  const items = (await apify(
    `/acts/${ACTOR()}/run-sync-get-dataset-items?timeout=50&clean=true&fields=asin,title,price,seller,inStock`,
    {
      method: "POST",
      body: JSON.stringify({
        categoryOrProductUrls: [{ url }],
        maxItemsPerStartUrl: 1,
        scrapeProductDetails: true,
        maxOffers: 0,
        maxProductVariantsAsSeparateResults: 0,
      }),
    },
  )) as (AmazonItem & { inStock?: boolean })[];
  const item = items[0];
  if (!item?.title) return { live: false, note: "Listing page not found — it looks removed." };
  if (item.inStock === false) {
    return { live: false, title: item.title, seller: item.seller?.name, note: "Page exists but the item is unavailable — likely taken down." };
  }
  return {
    live: true,
    title: item.title,
    price: Number(item.price?.value) || undefined,
    seller: item.seller?.name,
    note: `Still live${item.seller?.name ? `, sold by ${item.seller.name}` : ""}.`,
  };
}
