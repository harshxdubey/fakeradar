// Demo data: realistic Amazon.in search results plus pre-baked AI verdicts,
// templated on whatever product the owner enters so mock mode works for any brand.
import { productShot, type ShotSpec } from "./images";
import { inr } from "./format";
import type { Listing, Product, Verdict } from "./types";

export const SAMPLE_PRODUCT: Product = {
  brand: "TerraSip",
  name: "Bamboo Steel Water Bottle 1L",
  minPrice: 799,
  maxPrice: 999,
  photos: [
    productShot({ brand: "TerraSip", tagline: "BAMBOO · STEEL · 1 LITRE" }),
    productShot({ brand: "TerraSip", tagline: "KEEPS COLD 24H", background: "#eef3ee" }),
  ],
  authorisedSellers: ["TerraSip Official", "GreenNest Retail"],
  marketplace: "amazon_in",
};

/** Swap one character so the brand looks right at a glance. */
function misspell(brand: string): string {
  const swaps: [RegExp, string][] = [
    [/i/, "l"],
    [/o/, "0"],
    [/e/, "a"],
    [/a/, "e"],
  ];
  for (const [re, to] of swaps) if (re.test(brand.slice(1))) return brand[0] + brand.slice(1).replace(re, to);
  return brand + brand.slice(-1);
}

function misspell2(brand: string): string {
  if (brand.length < 4) return brand + "e";
  const i = Math.floor(brand.length / 2);
  return brand.slice(0, i) + brand[i + 1] + brand[i] + brand.slice(i + 2);
}

function asinFor(seed: string): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let out = "B0";
  for (let i = 0; i < 8; i++) {
    h = Math.imul(h ^ (h >>> 13), 2654435761);
    out += chars[Math.abs(h) % chars.length];
  }
  return out;
}

const pctBelow = (price: number, min: number) => Math.round((1 - price / min) * 100);

interface MockSpec {
  key: string;
  title: string;
  price: number;
  seller: string;
  shot: ShotSpec;
  verdict?: Verdict;
}

export function mockSearch(product: Product): { listings: Listing[]; verdicts: Record<string, Verdict> } {
  const B = product.brand.trim() || "YourBrand";
  const N = product.name.trim() || "Product";
  const M = product.minPrice > 0 ? product.minPrice : 799;
  const shape: ShotSpec["shape"] = /bottle|flask|tumbler|sipper/i.test(N) ? "bottle" : "box";
  const mis1 = misspell(B);
  const mis2 = misspell2(B);
  const notAuthorised = (s: string) => `Seller "${s}" is not on your authorised seller list`;
  const p = (f: number) => Math.round((M * f) / 10) * 10 - 1;

  const c1 = p(0.32), c2 = p(0.45), c3 = p(0.38), c4 = p(0.52), c5 = p(0.88);
  const k1 = p(0.7), k2 = p(0.78), k3 = p(0.66);

  const specs: MockSpec[] = [
    {
      key: "c1", title: `${mis1} ${N} – Premium Quality, Leak Proof`, price: c1, seller: "QuickDeals4U",
      shot: { brand: mis1, tagline: "BAMBOO · STEEL · 1 LITRE", shape, sticker: "70% OFF" },
      verdict: {
        label: "counterfeit", confidence: 0.94, seller_risk: "high",
        evidence: [
          `Brand on the label reads "${mis1}" — one character off your brand "${B}"`,
          `Price ${inr(c1)} is ${pctBelow(c1, M)}% below your minimum ${inr(M)}`,
          notAuthorised("QuickDeals4U"),
        ],
      },
    },
    {
      key: "c2", title: `${B} ${N} (Pack of 1)`, price: c2, seller: "MegaBazaar Online",
      shot: { brand: B, tagline: "BAMBOO · STEEL · 1 LITRE", shape, faded: true, body: "#3d7a5c" },
      verdict: {
        label: "counterfeit", confidence: 0.88, seller_risk: "high",
        evidence: [
          `Uses your exact brand name "${B}" at ${inr(c2)}, ${pctBelow(c2, M)}% below your minimum price`,
          "Photo has your label layout, but it is blurred and the colours are washed out compared with your authorised photo",
          notAuthorised("MegaBazaar Online"),
        ],
      },
    },
    {
      key: "c3", title: `${B.toUpperCase()} Original ${N} 100% Genuine`, price: c3, seller: "Shree Traders 77",
      shot: { brand: B.toUpperCase(), tagline: "100% ORIGINAL", shape, body: "#27593f", label: "#ffffff" },
      verdict: {
        label: "counterfeit", confidence: 0.86, seller_risk: "medium",
        evidence: [
          `Title insists "100% Genuine" while pricing at ${inr(c3)} (${pctBelow(c3, M)}% below your minimum)`,
          `Label prints the brand as "${B.toUpperCase()}" with a tagline not on your authorised photos`,
          notAuthorised("Shree Traders 77"),
        ],
      },
    },
    {
      key: "c4", title: `${mis2} ${N} Combo Offer`, price: c4, seller: "ValueKart Deals",
      shot: { brand: mis2, tagline: "BAMBOO · STEEL", shape, sticker: "COMBO" },
      verdict: {
        label: "counterfeit", confidence: 0.81, seller_risk: "medium",
        evidence: [
          `Brand reads "${mis2}" — letters swapped from "${B}"`,
          `Same product shape and label layout as your authorised photo`,
          `Price ${inr(c4)} is ${pctBelow(c4, M)}% below your minimum`,
        ],
      },
    },
    {
      key: "c5", title: `${N} by ${B} – Imported`, price: c5, seller: "Global Imports Hub",
      shot: { brand: B, tagline: "IMPORTED", shape, faded: true },
      verdict: {
        label: "counterfeit", confidence: 0.55, seller_risk: "low",
        evidence: [
          `Price ${inr(c5)} is only ${pctBelow(c5, M)}% below your minimum — could be a discount`,
          'Label adds "IMPORTED", which is not on your authorised photos',
          "Photo is a lower-quality version of your design — worth a test buy before reporting",
        ],
      },
    },
    {
      key: "k1", title: `EcoSip ${N} – Leakproof, BPA Free`, price: k1, seller: "EcoSip Store",
      shot: { brand: "EcoSip", tagline: "BAMBOO · STEEL · 1 LITRE", shape },
      verdict: {
        label: "copycat", confidence: 0.83, seller_risk: "medium",
        evidence: [
          "Label layout, colours and tagline mirror your authorised photo",
          `Different brand ("EcoSip") but the title copies your product name "${N}" word for word`,
          notAuthorised("EcoSip Store"),
        ],
      },
    },
    {
      key: "k2", title: `VerdeFlow ${N} | Eco Friendly`, price: k2, seller: "VerdeFlow India",
      shot: { brand: "VerdeFlow", tagline: "BAMBOO · STEEL · 1 LITRE", shape, body: "#35704f" },
      verdict: {
        label: "copycat", confidence: 0.76, seller_risk: "low",
        evidence: [
          "Same tagline text and label band position as your authorised photo",
          `Product name "${N}" reused in the title`,
        ],
      },
    },
    {
      key: "k3", title: `HydroLeaf ${N} – Gift Pack`, price: k3, seller: "HydroLeaf Official",
      shot: { brand: "HydroLeaf", tagline: "BAMBOO · STEEL · 1 LITRE", shape, cap: "#b89466" },
      verdict: {
        label: "copycat", confidence: 0.72, seller_risk: "low",
        evidence: [
          "Bottle colour, cap and label styling closely match your authorised photo",
          `Title reuses your product name "${N}"`,
        ],
      },
    },
    {
      key: "g1", title: `${B} ${N}`, price: M + 50, seller: product.authorisedSellers[0] || "Authorised Store",
      shot: { brand: B, tagline: "BAMBOO · STEEL · 1 LITRE", shape },
    },
    {
      key: "g2", title: `${B} ${N} – Original`, price: M + 100, seller: "HomeEssentials Mart",
      shot: { brand: B, tagline: "BAMBOO · STEEL · 1 LITRE", shape },
      verdict: {
        label: "possible_genuine_reseller", confidence: 0.78, seller_risk: "low",
        evidence: [
          "Photo matches your authorised photo exactly",
          `Price ${inr(M + 100)} is inside your ${inr(M)}–${inr(product.maxPrice || M)} range`,
          `Seller "HomeEssentials Mart" isn't on your list — may be a distributor's customer; verify before reporting`,
        ],
      },
    },
    {
      key: "u1", title: "Kids Plastic Sipper 500ml – Cartoon Print", price: 199, seller: "ToyTown",
      shot: { brand: "SipKid", tagline: "500 ML", shape: "bottle", body: "#f472b6", cap: "#60a5fa", label: "#fff7ed" },
      verdict: {
        label: "unrelated", confidence: 0.95, seller_risk: "low",
        evidence: ["Different product type and brand; matched only on the word \"sip\""],
      },
    },
    {
      key: "u2", title: "Bamboo Toothbrush, Pack of 4", price: 149, seller: "GreenSmile",
      shot: { brand: "GreenSmile", tagline: "PACK OF 4", shape: "box", body: "#a3b18a" },
      verdict: {
        label: "unrelated", confidence: 0.97, seller_risk: "low",
        evidence: ["Different product; matched only on the word \"bamboo\""],
      },
    },
  ];

  const listings: Listing[] = [];
  const verdicts: Record<string, Verdict> = {};
  for (const s of specs) {
    const asin = asinFor(s.key + B + N);
    const listing: Listing = {
      id: asin,
      asin,
      url: `https://www.amazon.in/dp/${asin}`,
      title: s.title,
      price: s.price,
      seller: s.seller,
      imageUrl: productShot(s.shot),
    };
    listings.push(listing);
    if (s.verdict) verdicts[asin] = s.verdict;
  }
  // The same top fake shows up twice in real search results (sponsored + organic).
  listings.splice(3, 0, { ...listings[0], url: listings[0].url + "?ref=sr_sponsored" });
  return { listings, verdicts };
}
