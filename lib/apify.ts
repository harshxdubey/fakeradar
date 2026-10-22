// Direct Apify connection (no n8n needed). Runs the Amazon scraper in the background;
// the browser polls /api/scan/poll so no single request hits the hosting time limit.
import { brandCore } from "./rulesClassifier";
import type { Listing, PendingScan, Product } from "./types";

const API = "https://api.apify.com/v2";
const ACTOR = () => (process.env.APIFY_ACTOR || "junglee/Amazon-crawler").replace("/", "~");
const MAX_ITEMS = () => Number(process.env.APIFY_MAX_ITEMS) || 15;

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

/** Core brand + the first 6 words of the product name, so a pasted Amazon title doesn't over-narrow the search. */
export function searchUrl(product: Product) {
  const core = brandCore(product.brand);
  const nameWords = product.name
    .replace(/['’]s\b/gi, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && w.toLowerCase() !== core)
    .slice(0, 6);
  const q = encodeURIComponent([core, ...nameWords].join(" ").trim()).replace(/%20/g, "+");
  return `https://www.amazon.in/s?k=${q}`;
}

export async function startApifyRun(product: Product): Promise<PendingScan> {
  const json = await apify(`/acts/${ACTOR()}/runs`, {
    method: "POST",
    body: JSON.stringify({
      categoryOrProductUrls: [{ url: searchUrl(product) }],
      maxItemsPerStartUrl: MAX_ITEMS(),
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
