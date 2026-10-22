// Free classifier: plain rules on brand spelling, price and title, no AI and no cost.
// It can't compare photos, so it is deliberately cautious; add ANTHROPIC_API_KEY to switch to Claude.
import { inr } from "./format";
import { PHOTO_SAME, PHOTO_SIMILAR } from "./imageHash";
import type { Listing, Product, Verdict } from "./types";

const STOPWORDS = new Set(["the", "and", "for", "with", "of", "a", "an", "in", "by", "to", "pack", "set", "new"]);

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Words owners add to a brand that never appear in the marketplace brand field ("DEEMOON Store" → "deemoon").
const BRAND_SUFFIXES = new Set([
  "store", "stores", "official", "india", "shop", "brand", "brands", "online", "retail",
  "pvt", "ltd", "private", "limited", "co", "company", "enterprises", "mart", "the",
]);

/** The brand as marketplaces show it: the owner's brand without store/company words. */
export function brandCore(brand: string): string {
  const core = words(brand).filter((w) => !BRAND_SUFFIXES.has(w)).join("");
  return core || compact(brand);
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Candidate brand strings in a listing: its brand field, single title words and adjacent word pairs. */
function brandCandidates(listing: Listing): string[] {
  const w = words(listing.title);
  const pairs = w.slice(0, -1).map((x, i) => x + w.at(i + 1));
  const fromBrandField = listing.brand ? [compact(listing.brand), brandCore(listing.brand)] : [];
  return [...fromBrandField, ...w, ...pairs].filter((x) => x.length >= 3);
}

type BrandMatch = { kind: "exact" } | { kind: "lookalike"; seen: string } | { kind: "none" };

function matchBrand(product: Product, listing: Listing): BrandMatch {
  const brand = brandCore(product.brand);
  if (!brand) return { kind: "none" };
  const candidates = brandCandidates(listing);
  if (candidates.includes(brand) || candidates.includes(compact(product.brand))) return { kind: "exact" };
  const maxDist = brand.length >= 7 ? 2 : brand.length >= 4 ? 1 : 0;
  for (const c of candidates) {
    const d = editDistance(brand, c);
    if (d > 0 && d <= maxDist) return { kind: "lookalike", seen: c };
  }
  return { kind: "none" };
}

/** Share of the owner's product-name words that appear in the listing title. */
function nameOverlap(product: Product, listing: Listing) {
  const mine = [...new Set(words(product.name).filter((w) => !STOPWORDS.has(w)))];
  if (!mine.length) return { share: 0, shared: [] as string[] };
  const theirs = new Set(words(listing.title));
  const shared = mine.filter((w) => theirs.has(w));
  // Long names (a pasted Amazon title) shouldn't make overlap look tiny: judge against at most 6 words.
  return { share: Math.min(1, shared.length / Math.min(mine.length, 6)), shared };
}

/**
 * @param photoMatch 0–1 similarity of the listing photo to your closest authorised photo
 *                   (free image fingerprint), or undefined when no photo could be compared.
 */
export function classifyWithRules(product: Product, listing: Listing, photoMatch?: number): Verdict {
  const brand = matchBrand(product, listing);
  const { share, shared } = nameOverlap(product, listing);
  const min = product.minPrice;
  const hasPrice = listing.price > 0 && min > 0;
  const pctBelow = hasPrice ? Math.round((1 - listing.price / min) * 100) : 0;
  const priceLine = hasPrice && pctBelow > 0 ? `Price ${inr(listing.price)} is ${pctBelow}% below your minimum ${inr(min)}` : null;
  const sellerLine = `Seller "${listing.seller}" is not on your authorised seller list`;

  const compared = photoMatch !== undefined;
  const pct = compared ? Math.round(photoMatch * 100) : 0;
  const samePhoto = compared && photoMatch >= PHOTO_SAME;
  const similarPhoto = compared && photoMatch >= PHOTO_SIMILAR;
  const photoLine = samePhoto
    ? `Photo is ${pct}% similar to your authorised photo — likely your own image, reused`
    : similarPhoto
      ? `Photo is ${pct}% similar to your authorised photo`
      : compared
        ? `Photo differs from your authorised photos (${pct}% similar)`
        : "Photos could not be compared — add an authorised photo, or open the listing to check";

  if (brand.kind === "lookalike") {
    return {
      label: "counterfeit",
      confidence: Math.min(0.95, (pctBelow >= 30 ? 0.9 : 0.8) + (similarPhoto ? 0.05 : 0)),
      seller_risk: "high",
      evidence: [
        `Brand reads "${brand.seen}" — a near-miss spelling of your brand "${product.brand}"`,
        priceLine ?? (similarPhoto ? photoLine : sellerLine),
        similarPhoto && priceLine ? photoLine : sellerLine,
      ],
    };
  }

  if (brand.kind === "exact") {
    // Brands sell many products: your brand on a listing that shares little of this product's name
    // and doesn't use its photo is most likely a different product of yours, not a fake of this one.
    const sameProduct = share >= 0.75 || similarPhoto;
    if (!sameProduct) {
      return {
        label: "possible_genuine_reseller",
        confidence: 0.4,
        seller_risk: "low",
        evidence: [
          `Uses your brand "${product.brand}" on what looks like a different product`,
          `Title shares little with "${product.name}"${compared ? " and the photo differs" : ""} — add that product to FakeRadar to check it properly`,
        ],
      };
    }
    if (pctBelow >= 30) {
      return {
        label: "counterfeit",
        confidence: pctBelow >= 50 ? 0.88 : 0.78,
        seller_risk: "high",
        evidence: [`Uses your brand name "${product.brand}"`, priceLine!, compared ? photoLine : sellerLine],
      };
    }
    if (pctBelow > 0) {
      // Slightly cheap + a photo that isn't yours is a stronger fake signal than price alone,
      // but only when the title clearly names this same product.
      const differentPhoto = compared && !similarPhoto && share >= 0.75;
      return {
        label: "counterfeit",
        // Still Unsure: one reference photo can't rule out colour variants, so this needs a human look.
        confidence: differentPhoto ? 0.62 : 0.5,
        seller_risk: differentPhoto ? "high" : "medium",
        evidence: [
          `Uses your brand name "${product.brand}"`,
          `${priceLine} — could just be a discount`,
          differentPhoto ? `${photoLine} — could be a colour variant; check before reporting` : photoLine,
        ],
      };
    }
    return {
      label: "possible_genuine_reseller",
      confidence: hasPrice ? 0.72 : 0.5,
      seller_risk: "low",
      evidence: [
        hasPrice
          ? `Uses your brand name "${product.brand}" at ${inr(listing.price)}, within or above your price`
          : `Uses your brand name "${product.brand}"; the listing shows no price, so it couldn't be compared`,
        `${sellerLine} — may be a distributor's customer; verify before reporting`,
        ...(compared ? [photoLine] : []),
      ],
    };
  }

  // A different brand using your photo is the clearest copycat signal there is.
  if (samePhoto) {
    return {
      label: "copycat",
      confidence: 0.86,
      seller_risk: "high",
      evidence: [
        `Different brand${listing.brand ? ` ("${listing.brand}")` : ""} using a photo ${pct}% similar to your authorised photo`,
        ...(shared.length >= 2 ? [`Title also reuses your product-name words: ${shared.join(", ")}`] : []),
        sellerLine,
      ],
    };
  }

  if (share >= 0.75 && shared.length >= 2) {
    return {
      label: "copycat",
      // Below the queue threshold unless the photo also looks like yours.
      confidence: similarPhoto ? 0.76 : 0.6,
      seller_risk: "medium",
      evidence: [
        `Different brand${listing.brand ? ` ("${listing.brand}")` : ""}, but the title reuses ${shared.length} of your product-name words: ${shared.join(", ")}`,
        photoLine,
      ],
    };
  }
  if (share >= 0.5 && shared.length >= 2) {
    return {
      label: "copycat",
      confidence: similarPhoto ? 0.6 : 0.4,
      seller_risk: "low",
      evidence: [
        `Title shares some of your product-name words (${shared.join(", ")}) — may just be a similar product`,
        photoLine,
      ],
    };
  }
  return {
    label: "unrelated",
    confidence: 0.85,
    seller_risk: "low",
    evidence: ["No brand match and little overlap with your product name"],
  };
}
