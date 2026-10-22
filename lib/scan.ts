// Server-side scan pipeline: search → rules (dedupe, authorised sellers) → classify → result.
// Data: demo mock listings, an n8n webhook, or Apify directly (free tier, no n8n needed).
// Classifier: Claude (direct or OpenRouter), else Gemini, else the free rule checks.
import { getRunListings, getRunStatus, hasApifyToken, startApifyRun } from "./apify";
import { aiProvider, classifyListing } from "./claude";
import { bestMatch } from "./imageHash";
import { hashImage } from "./imageHash.server";
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
    photoHashes: (product.photoHashes || []).filter((h) => /^[0-9a-f]{16}$/.test(h)).slice(0, 3),
    knownOffenders: (product.knownOffenders || []).slice(0, 200),
    confirmedAsins: (product.confirmedAsins || []).map(String).slice(0, 500),
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
  const provider = aiProvider();
  let aiOk = 0;
  let aiError: string | undefined;

  const items: ScanItem[] = await mapLimit(candidates, 4, async (listing) => {
    const photoMatch = bestMatch(await hashImage(listing.imageUrl), product.photoHashes);
    if (!provider) return applyHistory(product, { listing, photoMatch, verdict: classifyWithRules(product, listing, photoMatch) });
    try {
      const verdict = await classifyListing(product, listing);
      aiOk++;
      return applyHistory(product, { listing, photoMatch, verdict });
    } catch (err) {
      // AI unavailable for this listing: fall back to the free rules rather than dropping it.
      aiError ??= (err as Error).message.slice(0, 300);
      console.error(`[scan] ${provider} classification failed for ${listing.asin}:`, (err as Error).message);
      return applyHistory(product, { listing, photoMatch, verdict: classifyWithRules(product, listing, photoMatch) });
    }
  });

  // Report what actually judged the listings, not just which key is configured.
  const classifier = provider && aiOk > 0 ? provider : "rules";
  const result = buildResult(product, raw, "live", classifier, items, duplicatesRemoved, unique.length, authorised);
  if (provider && aiError) {
    const name = provider === "gemini" ? "Gemini" : "Claude";
    const failed = items.length - aiOk;
    result.aiNote = `${name} couldn't check ${failed} of ${items.length} listings: ${explainAiError(aiError, provider)} Those listings used the free rule checks instead.`;
  }
  return result;
}

/** Turn a raw provider error into one line the owner can act on. */
function explainAiError(raw: string, provider: "claude" | "gemini"): string {
  const keyVar = provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY / OPENROUTER_API_KEY";
  if (/api key not valid|invalid.*key|401|403|unauthori[sz]ed|permission/i.test(raw)) {
    return `the API key was rejected. Update ${keyVar} in Vercel and redeploy.`;
  }
  if (/429|quota|rate limit|resource.?exhausted/i.test(raw)) return "the free-tier limit was reached. Try again in a minute.";
  if (/404|not found|model/i.test(raw)) return `the model name wasn't found. Check ${provider === "gemini" ? "GEMINI_MODEL" : "the model setting"} in Vercel.`;
  return `the AI service returned an error (${raw.replace(/\s+/g, " ").slice(0, 80)}).`;
}

export async function runDemoScan(product: Product): Promise<ScanResult> {
  const { listings, verdicts } = mockSearch(product);
  const { unique, duplicatesRemoved } = dedupeByUrl(listings);
  const { authorised, candidates } = splitAuthorised(unique, product.authorisedSellers);
  const items: ScanItem[] = await mapLimit(candidates, 6, async (listing) =>
    applyHistory(product, {
      listing,
      verdict: verdicts[listing.id] as Verdict,
      photoMatch: bestMatch(await hashImage(listing.imageUrl), product.photoHashes),
    }),
  );
  return buildResult(product, listings, "mock", "demo", items, duplicatesRemoved, unique.length, authorised);
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Brand memory: a listing you already confirmed as fake that is still up, or a seller with
 * earlier confirmed fakes, is pushed to the top with that history as the first reason.
 */
function applyHistory(product: Product, item: ScanItem): ScanItem {
  const { listing } = item;
  let verdict = item.verdict;
  if (product.confirmedAsins?.includes(listing.asin)) {
    verdict = {
      label: verdict.label === "copycat" ? "copycat" : "counterfeit",
      confidence: Math.max(verdict.confidence, 0.95),
      seller_risk: "high",
      evidence: ["You already confirmed this listing as fake — it is still live", ...verdict.evidence].slice(0, 3),
    };
  } else {
    const offender = product.knownOffenders?.find((o) => norm(o.seller) === norm(listing.seller));
    if (offender && verdict.label !== "unrelated") {
      verdict = {
        ...verdict,
        label: verdict.label === "possible_genuine_reseller" ? "counterfeit" : verdict.label,
        confidence: Math.min(0.95, Math.max(verdict.confidence, 0.6) + 0.15),
        seller_risk: "high",
        evidence: [
          `Repeat offender: you confirmed ${offender.count} fake listing${offender.count === 1 ? "" : "s"} from "${offender.seller}" before`,
          ...verdict.evidence,
        ].slice(0, 3),
      };
    }
  }
  return { ...item, verdict };
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
