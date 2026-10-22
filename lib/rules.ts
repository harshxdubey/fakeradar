// Deterministic rules applied around the AI step. No model calls here.
import { brandCore } from "./rulesClassifier";
import type { Bucket, Decision, Listing, ScanItem } from "./types";

export const QUEUE_THRESHOLD = 0.7;
export const UNSURE_THRESHOLD = 0.3;
export const ASSUMED_UNITS_PER_WEEK = 10;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function dedupeByUrl(listings: Listing[]) {
  const seen = new Set<string>();
  const unique: Listing[] = [];
  for (const l of listings) {
    const key = l.url.split("?")[0].replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(l);
  }
  return { unique, duplicatesRemoved: listings.length - unique.length };
}

/**
 * @param brand when given, a seller named after the brand itself (e.g. "DEEMOON", "DEEMOON Store")
 *              counts as authorised: that is the brand's own storefront.
 */
export function splitAuthorised(listings: Listing[], authorisedSellers: string[], brand?: string) {
  const allow = new Set(authorisedSellers.map(norm).filter(Boolean));
  const own = brand ? brandCore(brand) : "";
  const isOwn = (seller: string) => own.length >= 3 && brandCore(seller) === own;
  const authorised: Listing[] = [];
  const candidates: Listing[] = [];
  for (const l of listings) (allow.has(norm(l.seller)) || isOwn(l.seller) ? authorised : candidates).push(l);
  return { authorised, candidates };
}

/** Where a classified listing shows up, given the AI verdict and the owner's decision. */
export function bucketFor(item: ScanItem, decision?: Decision): Bucket {
  if (decision === "genuine") return "hidden";
  if (decision === "unsure") return "unsure";
  if (decision === "confirmed") return "queue";
  if (item.verdict.label === "unrelated") return "hidden";
  if (item.verdict.confidence >= QUEUE_THRESHOLD) return "queue";
  if (item.verdict.confidence >= UNSURE_THRESHOLD) return "unsure";
  return "hidden";
}

export function isSuspected(item: ScanItem) {
  return item.verdict.label === "counterfeit" || item.verdict.label === "copycat";
}
