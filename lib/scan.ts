// Server-side scan pipeline: search → rules (dedupe, authorised sellers) → AI → result.
import { classifyListing, hasApiKey } from "./claude";
import { mockSearch } from "./mock";
import { dedupeByUrl, splitAuthorised } from "./rules";
import type { Listing, Product, ScanItem, ScanResult, Verdict } from "./types";

export const isMockMode = () => process.env.USE_MOCK_DATA !== "false";

async function liveSearch(product: Product): Promise<Listing[]> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) throw new Error("N8N_WEBHOOK_URL is not set (required when USE_MOCK_DATA=false)");
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

export async function runScan(product: Product): Promise<ScanResult> {
  const mock = isMockMode();
  let raw: Listing[];
  let prebaked: Record<string, Verdict> = {};

  if (mock) {
    const m = mockSearch(product);
    raw = m.listings;
    prebaked = m.verdicts;
  } else {
    if (!hasApiKey()) throw new Error("ANTHROPIC_API_KEY is not set (required when USE_MOCK_DATA=false)");
    raw = await liveSearch(product);
  }

  const { unique, duplicatesRemoved } = dedupeByUrl(raw);
  const { authorised, candidates } = splitAuthorised(unique, product.authorisedSellers);

  const items: ScanItem[] = await mapLimit(candidates, 4, async (listing) => {
    if (mock) return { listing, verdict: prebaked[listing.id] };
    try {
      return { listing, verdict: await classifyListing(product, listing) };
    } catch (err) {
      // Keep the listing visible for manual review rather than silently dropping it.
      return {
        listing,
        verdict: {
          label: "possible_genuine_reseller",
          confidence: 0.4,
          seller_risk: "low",
          evidence: [`AI check failed (${(err as Error).message.slice(0, 80)}) — review this listing manually`],
        } satisfies Verdict,
      };
    }
  });

  return {
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    mode: mock ? "mock" : "live",
    product: { ...product, photos: [] }, // photos stay in the browser; not echoed back
    scanned: unique.length,
    duplicatesRemoved,
    authorisedFiltered: authorised,
    items: items.filter((i) => i.verdict),
  };
}
