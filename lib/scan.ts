// Server-side scan pipeline: search → rules (dedupe, authorised sellers) → classify → result.
// Data: demo mock listings, an n8n webhook, or Apify directly (free tier, no n8n needed).
// Classifier: Claude when ANTHROPIC_API_KEY is set, otherwise the free rule checks.
import { getRunListings, getRunStatus, hasApifyToken, startApifyRun } from "./apify";
import { classifyListing, hasApiKey } from "./claude";
import { mockSearch } from "./mock";
import { dedupeByUrl, splitAuthorised } from "./rules";
import { classifyWithRules } from "./rulesClassifier";
import type { Listing, PendingScan, Product, ScanItem, ScanResult, Verdict } from "./types";

export const isMockMode = () => process.env.USE_MOCK_DATA !== "false";

export function cleanProduct(product: Product): Product {
  return {
    ...product,
    minPrice: Number(product.minPrice) || 0,
    maxPrice: Number(product.maxPrice) || 0,
    photos: (product.photos || []).slice(0, 3),
    authorisedSellers: (product.authorisedSellers || []).map(String),
  };
}

async function n8nSearch(product: Product, url: string): Promise<Listing[]> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `${product.brand} ${product.name}`,
      marketplace: product.marketplace,
      maxResults: 20,
    }),
  });
  if (!res.ok) throw new Error(`n8n webhook returned ${res.status}`);
  const json = (await res.json()) as { listings?: Listing[] };
  if (!Array.isArray(json.listings)) throw new Error("n8n webhook response is missing a `listings` array");
  return json.listings.map((l, i) => ({ ...l, id: l.id || l.asin || `listing-${i}` }));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function buildResult(
  product: Product,
  raw: Listing[],
  mode: ScanResult["mode"],
  classifier: ScanResult["classifier"],
  items: ScanItem[],
  duplicatesRemoved: number,
  scanned: number,
  authorised: Listing[],
): ScanResult {
  return {
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    mode,
    classifier,
    product: { ...product, photos: [] }, // photos stay in the browser; not echoed back
    scanned,
    duplicatesRemoved,
    authorisedFiltered: authorised,
    items: items.filter((i) => i.verdict),
  };
}

/** Rules + classification on real listings, shared by the n8n and Apify paths. */
async function classifyLive(product: Product, raw: Listing[]): Promise<ScanResult> {
  const { unique, duplicatesRemoved } = dedupeByUrl(raw);
  const { authorised, candidates } = splitAuthorised(unique, product.authorisedSellers);
  const useClaude = hasApiKey();

  const items: ScanItem[] = await mapLimit(candidates, 4, async (listing) => {
    if (!useClaude) return { listing, verdict: classifyWithRules(product, listing) };
    try {
      return { listing, verdict: await classifyListing(product, listing) };
    } catch {
      // Claude unavailable for this listing: fall back to the free rules rather than dropping it.
      return { listing, verdict: classifyWithRules(product, listing) };
    }
  });

  return buildResult(product, raw, "live", useClaude ? "claude" : "rules", items, duplicatesRemoved, unique.length, authorised);
}

export function runDemoScan(product: Product): ScanResult {
  const { listings, verdicts } = mockSearch(product);
  const { unique, duplicatesRemoved } = dedupeByUrl(listings);
  const { authorised, candidates } = splitAuthorised(unique, product.authorisedSellers);
  const items: ScanItem[] = candidates.map((listing) => ({ listing, verdict: verdicts[listing.id] as Verdict }));
  return buildResult(product, listings, "mock", "demo", items, duplicatesRemoved, unique.length, authorised);
}

/** Starts a live scan. n8n answers in one request; Apify runs in the background and is polled. */
export async function startLiveScan(product: Product): Promise<{ result: ScanResult } | { pending: PendingScan }> {
  const n8n = process.env.N8N_WEBHOOK_URL;
  if (n8n) return { result: await classifyLive(product, await n8nSearch(product, n8n)) };
  if (hasApifyToken()) return { pending: await startApifyRun(product) };
  throw new Error("Live mode needs APIFY_TOKEN (or N8N_WEBHOOK_URL). Set one in your environment variables.");
}

/** Checks a background Apify run; returns the finished result once the scraper is done. */
export async function pollLiveScan(product: Product, pending: PendingScan): Promise<{ result: ScanResult } | { pending: PendingScan }> {
  const status = await getRunStatus(pending.runId);
  if (status === "running") return { pending };
  if (status === "failed") throw new Error("The Amazon.in scraper run failed. Please try the scan again.");
  return { result: await classifyLive(product, await getRunListings(pending.datasetId)) };
}
