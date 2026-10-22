// Demo data: realistic Amazon.in search results plus pre-baked AI verdicts,
// templated on whatever product the owner enters so mock mode works for any brand.
import { bagShot, productShot, type BagSpec, type ShotSpec } from "./images";
import { inr } from "./format";
import type { Listing, Product, Verdict } from "./types";

// A fictional luxury house (matches the home page), so the demo never names a real brand.
export const SAMPLE_PRODUCT: Product = {
  brand: "Maison Vela",
  name: "Top-Handle Leather Bag",
  minPrice: 24900,
  maxPrice: 29900,
  photos: [bagShot({ brand: "Maison Vela" }), bagShot({ brand: "Maison Vela", background: "#f0ebe5" })],
  authorisedSellers: ["Maison Vela Official", "Vela Boutique Delhi"],
  marketplace: "amazon_in",
};

/** Swap one character so the brand looks right at a glance. Multi-word brands double a letter: "Vela" → "Vella". */
function misspell(brand: string): string {
  const words = brand.split(" ");
  const last = words.at(-1) ?? "";
  if (words.length > 1 && last.length >= 3) {
    const c = last.at(-2) ?? "";
    const doubled = /[^aeiou]/i.test(c) ? last.slice(0, -1) + c + last.slice(-1) : last + last.slice(-1);
    return [...words.slice(0, -1), doubled].join(" ");
  }
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
  const words = brand.split(" ");
  if (words.length > 1) {
    const last = words.at(-1) ?? "";
    if (last.length >= 4) {
      const i = Math.floor(last.length / 2) - 1;
      return [...words.slice(0, -1), last.slice(0, i) + last[i + 1] + last[i] + last.slice(i + 2)].join(" ");
    }
  }
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
  /** How this listing looks when the product is a bag. */
  bag?: BagSpec;
  verdict?: Verdict;
}

/** Words and names that fit the product type, so a bag demo doesn't talk about bottle caps. */
function vocabulary(isBag: boolean) {
  return isBag
    ? {
        mark: "plate",
        c1Tail: "– Premium Leather, Gold Hardware",
        c2Photo: "Photo copies your bag’s shape and plate, but the leather is a shade off and the stitching is uneven",
        c3Photo: (b: string) => `Plate prints the brand as "${b}", unlike your authorised photos`,
        c4Photo: "Same bag shape, plate and clasp position as your authorised photo",
        c5Extra: 'Title adds "Imported", which your brand never uses',
        k: [
          ["Belle Maison", "– Vegan Leather, Gold Clasp", "Belle Maison Store"],
          ["Luxora", "| Party Wear", "Luxora Fashion"],
          ["Cavelli", "– Gift Box", "Cavelli Official"],
        ],
        k1Photo: "Shape, leather colour and gold plate mirror your authorised photo",
        k2Photo: "Same silhouette and plate position as your authorised photo",
        k3Photo: "Leather colour, gold plate and clasp closely match your authorised photo",
        g2Seller: "Luxe Closet Resale",
        u: [
          ["Men's Leather Wallet – RFID Blocking", 699, "WalletCo", 'Different product; matched only on the word "leather"'],
          ["Laptop Backpack 30L", 1299, "PackRight", 'Different product; matched only on the word "bag"'],
        ] as [string, number, string, string][],
      }
    : {
        mark: "label",
        c1Tail: "– Premium Quality, Leak Proof",
        c2Photo: "Photo has your label layout, but it is blurred and the colours are washed out compared with your authorised photo",
        c3Photo: (b: string) => `Label prints the brand as "${b}" with a tagline not on your authorised photos`,
        c4Photo: "Same product shape and label layout as your authorised photo",
        c5Extra: 'Label adds "IMPORTED", which is not on your authorised photos',
        k: [
          ["EcoSip", "– Leakproof, BPA Free", "EcoSip Store"],
          ["VerdeFlow", "| Eco Friendly", "VerdeFlow India"],
          ["HydroLeaf", "– Gift Pack", "HydroLeaf Official"],
        ],
        k1Photo: "Label layout, colours and tagline mirror your authorised photo",
        k2Photo: "Same tagline text and label band position as your authorised photo",
        k3Photo: "Bottle colour, cap and label styling closely match your authorised photo",
        g2Seller: "HomeEssentials Mart",
        u: [
          ["Kids Plastic Sipper 500ml – Cartoon Print", 199, "ToyTown", 'Different product type and brand; matched only on the word "sip"'],
          ["Bamboo Toothbrush, Pack of 4", 149, "GreenSmile", 'Different product; matched only on the word "bamboo"'],
        ] as [string, number, string, string][],
      };
}

export function mockSearch(product: Product): { listings: Listing[]; verdicts: Record<string, Verdict> } {
  const B = product.brand.trim() || "YourBrand";
  const N = product.name.trim() || "Product";
  const M = product.minPrice > 0 ? product.minPrice : 799;
  const shape: ShotSpec["shape"] = /bottle|flask|tumbler|sipper/i.test(N) ? "bottle" : "box";
  const isBag = /\b(bag|handbag|tote|purse|clutch|satchel)\b/i.test(N);
  const W = vocabulary(isBag);
  const [K1, K2, K3] = W.k;
  const [U1, U2] = W.u;
  const mis1 = misspell(B);
  const mis2 = misspell2(B);
  const notAuthorised = (s: string) => `Seller "${s}" is not on your authorised seller list`;
  const p = (f: number) => (isBag ? Math.round((M * f) / 100) * 100 : Math.round((M * f) / 10) * 10) - 1;

  // A luxury fake sells for a tenth of the price; an everyday product's at about a third.
  const c1 = isBag ? Math.round((M * 0.1) / 100) * 100 - 1 : p(0.32), c2 = p(0.45), c3 = p(0.38), c4 = p(0.52), c5 = p(0.88);
  const k1 = p(0.7), k2 = p(0.78), k3 = p(0.66);

  const specs: MockSpec[] = [
    {
      key: "c1", title: `${mis1} ${N} ${W.c1Tail}`, price: c1, seller: "QuickDeals4U",
      shot: { brand: mis1, tagline: "BAMBOO · STEEL · 1 LITRE", shape, sticker: "70% OFF" },
      bag: { brand: mis1, leather: "#8a5634", flap: "#6b4024", hardware: "#e3c463", sloppy: true, sticker: "90% OFF" },
      verdict: {
        label: "counterfeit", confidence: 0.94, seller_risk: "high",
        evidence: [
          `Brand on the ${W.mark} reads "${mis1}" — one letter off your brand "${B}"`,
          `Price ${inr(c1)} is ${pctBelow(c1, M)}% below your minimum ${inr(M)}`,
          notAuthorised("QuickDeals4U"),
        ],
      },
    },
    {
      key: "c2", title: `${B} ${N} ${isBag ? "– Women's Handbag" : "(Pack of 1)"}`, price: c2, seller: "MegaBazaar Online",
      shot: { brand: B, tagline: "BAMBOO · STEEL · 1 LITRE", shape, faded: true, body: "#3d7a5c" },
      bag: { brand: B, leather: "#94603d", flap: "#734a2c", hardware: "#e6cf7a", sloppy: true },
      verdict: {
        label: "counterfeit", confidence: 0.88, seller_risk: "high",
        evidence: [
          `Uses your exact brand name "${B}" at ${inr(c2)}, ${pctBelow(c2, M)}% below your minimum price`,
          W.c2Photo,
          notAuthorised("MegaBazaar Online"),
        ],
      },
    },
    {
      key: "c3", title: `${B.toUpperCase()} Original ${N} 100% Genuine`, price: c3, seller: "Shree Traders 77",
      shot: { brand: B.toUpperCase(), tagline: "100% ORIGINAL", shape, body: "#27593f", label: "#ffffff" },
      bag: { brand: B, leather: "#6a3d24", flap: "#4f2c18", sloppy: true },
      verdict: {
        label: "counterfeit", confidence: 0.86, seller_risk: "medium",
        evidence: [
          `Title insists "100% Genuine" while pricing at ${inr(c3)} (${pctBelow(c3, M)}% below your minimum)`,
          W.c3Photo(B.toUpperCase()),
          notAuthorised("Shree Traders 77"),
        ],
      },
    },
    {
      key: "c4", title: `${mis2} ${N} Combo Offer`, price: c4, seller: "ValueKart Deals",
      shot: { brand: mis2, tagline: "BAMBOO · STEEL", shape, sticker: "COMBO" },
      bag: { brand: mis2, sloppy: true, sticker: "COMBO" },
      verdict: {
        label: "counterfeit", confidence: 0.81, seller_risk: "medium",
        evidence: [
          `Brand reads "${mis2}" — letters swapped from "${B}"`,
          W.c4Photo,
          `Price ${inr(c4)} is ${pctBelow(c4, M)}% below your minimum`,
        ],
      },
    },
    {
      key: "c5", title: `${N} by ${B} – Imported`, price: c5, seller: "Global Imports Hub",
      shot: { brand: B, tagline: "IMPORTED", shape, faded: true },
      bag: { brand: B, leather: "#7f4f31", sloppy: true },
      verdict: {
        label: "counterfeit", confidence: 0.55, seller_risk: "low",
        evidence: [
          `Price ${inr(c5)} is only ${pctBelow(c5, M)}% below your minimum — could be a discount`,
          W.c5Extra,
          "Photo is a lower-quality version of your design — worth a test buy before reporting",
        ],
      },
    },
    {
      key: "k1", title: `${K1[0]} ${N} ${K1[1]}`, price: k1, seller: K1[2],
      shot: { brand: K1[0], tagline: "BAMBOO · STEEL · 1 LITRE", shape },
      bag: { brand: K1[0] },
      verdict: {
        label: "copycat", confidence: 0.83, seller_risk: "medium",
        evidence: [
          W.k1Photo,
          `Different brand ("${K1[0]}") but the title copies your product name "${N}" word for word`,
          notAuthorised(K1[2]),
        ],
      },
    },
    {
      key: "k2", title: `${K2[0]} ${N} ${K2[1]}`, price: k2, seller: K2[2],
      shot: { brand: K2[0], tagline: "BAMBOO · STEEL · 1 LITRE", shape, body: "#35704f" },
      bag: { brand: K2[0], leather: "#3a3a40", flap: "#26262b" },
      verdict: {
        label: "copycat", confidence: 0.76, seller_risk: "low",
        evidence: [
          W.k2Photo,
          `Product name "${N}" reused in the title`,
        ],
      },
    },
    {
      key: "k3", title: `${K3[0]} ${N} ${K3[1]}`, price: k3, seller: K3[2],
      shot: { brand: K3[0], tagline: "BAMBOO · STEEL · 1 LITRE", shape, cap: "#b89466" },
      bag: { brand: K3[0], leather: "#7a4a2e" },
      verdict: {
        label: "copycat", confidence: 0.72, seller_risk: "low",
        evidence: [
          W.k3Photo,
          `Title reuses your product name "${N}"`,
        ],
      },
    },
    {
      key: "g1", title: `${B} ${N}`, price: M + 50, seller: product.authorisedSellers[0] || "Authorised Store",
      shot: { brand: B, tagline: "BAMBOO · STEEL · 1 LITRE", shape },
      bag: { brand: B },
    },
    {
      key: "g2", title: `${B} ${N} – Original`, price: M + 100, seller: W.g2Seller,
      shot: { brand: B, tagline: "BAMBOO · STEEL · 1 LITRE", shape },
      bag: { brand: B },
      verdict: {
        label: "possible_genuine_reseller", confidence: 0.78, seller_risk: "low",
        evidence: [
          "Photo matches your authorised photo exactly",
          `Price ${inr(M + 100)} is inside your ${inr(M)}–${inr(product.maxPrice || M)} range`,
          `Seller "${W.g2Seller}" isn't on your list — may be a distributor's customer; verify before reporting`,
        ],
      },
    },
    {
      key: "u1", title: U1[0], price: U1[1], seller: U1[2],
      shot: { brand: "SipKid", tagline: "500 ML", shape: "bottle", body: "#f472b6", cap: "#60a5fa", label: "#fff7ed" },
      bag: { brand: U1[2], leather: "#2b2b2b", flap: "#1a1a1a" },
      verdict: { label: "unrelated", confidence: 0.95, seller_risk: "low", evidence: [U1[3]] },
    },
    {
      key: "u2", title: U2[0], price: U2[1], seller: U2[2],
      shot: { brand: "GreenSmile", tagline: "PACK OF 4", shape: "box", body: "#a3b18a" },
      bag: { brand: U2[2], leather: "#3b4a5a", flap: "#2c3845" },
      verdict: { label: "unrelated", confidence: 0.97, seller_risk: "low", evidence: [U2[3]] },
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
      imageUrl: isBag && s.bag ? bagShot(s.bag) : productShot(s.shot),
    };
    listings.push(listing);
    if (s.verdict) verdicts[asin] = s.verdict;
  }
  // The same top fake shows up twice in real search results (sponsored + organic).
  listings.splice(3, 0, { ...listings[0], url: listings[0].url + "?ref=sr_sponsored" });
  return { listings, verdicts };
}
